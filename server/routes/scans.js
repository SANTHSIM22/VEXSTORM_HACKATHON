// ──────────────────────────────────────────────
// Scan Routes — /api/scans (Task 1 & 3)
// All routes are protected via JWT middleware
// ──────────────────────────────────────────────

const express = require('express');
const crypto = require('crypto');
const { protect } = require('../middleware/auth');
const { createScanEntry, getScanEntry, getAllScans } = require('../scanRegistry');
const Orchestrator = require('../orchestrator/orchestrator');
const FindingsStore = require('../intelligence/findingsStore');
const ScanMemory = require('../intelligence/memory');
const Logger = require('../utils/logger');
const { createScanFolder, generateReport } = require('../reporting/reportGenerator');
const Scan = require('../models/Scan');
const User = require('../models/User');

const router = express.Router();

// ─── POST /api/scans — Start a new scan ──────────────
router.post('/', protect, async (req, res) => {
  const { targetUrl, scanType, scanName } = req.body;

  if (!targetUrl) {
    return res.status(400).json({ message: 'targetUrl is required' });
  }

  const trimmedName = (scanName || '').trim();
  const scanId = crypto.randomUUID();
  const entry = createScanEntry(scanId, targetUrl, req.user._id.toString(), trimmedName);

  // Persist initial scan document to MongoDB
  try {
    await Scan.create({
      scanId,
      userId: req.user._id,
      targetUrl,
      scanName: trimmedName,
      status: 'running',
      createdAt: entry.createdAt,
    });
  } catch (dbErr) {
    console.error('[Scans] Failed to persist scan to MongoDB:', dbErr.message);
  }

  // Return immediately (non-blocking)
  res.status(201).json({
    scanId,
    status: 'running',
    targetUrl,
    scanName: trimmedName,
    createdAt: entry.createdAt,
  });

  // Fire-and-forget: run scan in background
  runScan(entry, targetUrl, scanType, req.user._id).catch((err) => {
    entry.status = 'failed';
    entry.completedAt = new Date().toISOString();
    entry.logs.push({
      time: new Date().toISOString(),
      agent: 'SYSTEM',
      msg: `Fatal error: ${err.message}`,
    });
  });
});

// ─── GET /api/scans — List all scans for current user ─
router.get('/', protect, async (req, res) => {
  // In-memory entries (covers currently running scans)
  const inMemory = getAllScans(req.user._id.toString());
  const inMemoryIds = new Set(inMemory.map((s) => s.scanId));

  // Pull completed/failed scans from MongoDB that aren't in memory
  let dbScans = [];
  try {
    dbScans = await Scan.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
  } catch (dbErr) {
    console.error('[Scans] MongoDB list error:', dbErr.message);
  }

  const dbOnly = dbScans.filter((s) => !inMemoryIds.has(s.scanId));

  const merged = [
    ...inMemory.map((s) => ({
      scanId: s.scanId,
      targetUrl: s.targetUrl,
      scanName: s.scanName,
      status: s.status,
      currentPhase: s.currentPhase || null,
      createdAt: s.createdAt,
      completedAt: s.completedAt,
      vulnerabilityCount: s.vulnerabilityCount,
      riskScore: s.riskScore,
      bySeverity: s.bySeverity,
    })),
    ...dbOnly.map((s) => ({
      scanId: s.scanId,
      targetUrl: s.targetUrl,
      scanName: s.scanName,
      status: s.status,
      currentPhase: null,
      createdAt: s.createdAt,
      completedAt: s.completedAt,
      vulnerabilityCount: s.vulnerabilityCount,
      riskScore: s.riskScore,
      bySeverity: s.bySeverity,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(merged);
});

// ─── GET /api/scans/:scanId — Full scan details ──────
router.get('/:scanId', protect, async (req, res) => {
  // Try in-memory registry first (live data for running scans)
  const entry = getScanEntry(req.params.scanId);
  if (entry) {
    return res.json({
      scanId: entry.scanId,
      targetUrl: entry.targetUrl,
      scanName: entry.scanName,
      status: entry.status,
      currentPhase: entry.currentPhase || null,
      createdAt: entry.createdAt,
      completedAt: entry.completedAt,
      summary: entry.summary,
      vulnerabilities: entry.findings,
      logs: entry.logs,
      vulnerabilityCount: entry.vulnerabilityCount,
      riskScore: entry.riskScore,
      bySeverity: entry.bySeverity,
    });
  }

  // Fall back to MongoDB
  try {
    const doc = await Scan.findOne({ scanId: req.params.scanId, userId: req.user._id }).lean();
    if (!doc) return res.status(404).json({ message: 'Scan not found' });
    return res.json({
      scanId: doc.scanId,
      targetUrl: doc.targetUrl,
      scanName: doc.scanName,
      status: doc.status,
      currentPhase: null,
      createdAt: doc.createdAt,
      completedAt: doc.completedAt,
      summary: doc.summary,
      vulnerabilities: doc.findings,
      logs: doc.logs,
      vulnerabilityCount: doc.vulnerabilityCount,
      riskScore: doc.riskScore,
      bySeverity: doc.bySeverity,
    });
  } catch (dbErr) {
    return res.status(500).json({ message: 'Database error', error: dbErr.message });
  }
});

// ─── GET /api/scans/:scanId/logs — Scan log lines ────
router.get('/:scanId/logs', protect, async (req, res) => {
  const entry = getScanEntry(req.params.scanId);
  if (entry) return res.json(entry.logs);

  // Fall back to MongoDB
  try {
    const doc = await Scan.findOne({ scanId: req.params.scanId, userId: req.user._id }).select('logs').lean();
    if (!doc) return res.status(404).json({ message: 'Scan not found' });
    return res.json(doc.logs);
  } catch (dbErr) {
    return res.status(500).json({ message: 'Database error', error: dbErr.message });
  }
});

// ──────────────────────────────────────────────
// Background scan runner
// ──────────────────────────────────────────────
async function runScan(entry, targetUrl, scanType, userId) {
  let scanFolder;
  try {
    scanFolder = createScanFolder();
    const logger = new Logger(scanFolder);
    const findingsStore = new FindingsStore();
    const memory = new ScanMemory(targetUrl, {
      scanFolder,
      scanType: scanType || 'full',
    });

    entry.logs.push({
      time: new Date().toISOString(),
      agent: 'SYSTEM',
      msg: `Scan initiated for ${targetUrl}`,
    });

    // Pass registryRef so the orchestrator can push live logs
    const orchestrator = new Orchestrator(logger, memory, findingsStore, entry);
    const report = await orchestrator.run(targetUrl);

    // Generate file reports
    await generateReport(scanFolder, targetUrl, report);

    // Populate registry entry with final results
    entry.status = 'completed';
    entry.completedAt = new Date().toISOString();
    entry.findings = report.findings || [];
    entry.vulnerabilityCount = report.findings?.length || 0;
    entry.summary = report.scanSummary || null;
    entry.report = report;

    // Compute severity breakdown
    const sev = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of entry.findings) {
      const s = (f.severity || '').toLowerCase();
      if (sev[s] !== undefined) sev[s]++;
    }
    entry.bySeverity = sev;

    // Compute aggregate risk score
    if (entry.findings.length > 0) {
      const total = entry.findings.reduce(
        (sum, f) => sum + (f.cvssScore || 0),
        0
      );
      entry.riskScore =
        Math.round((total / entry.findings.length) * 10) / 10;
    }

    entry.logs.push({
      time: new Date().toISOString(),
      agent: 'SYSTEM',
      msg: `Scan completed. ${entry.vulnerabilityCount} vulnerabilities found.`,
    });

    // ─── Persist completed scan to MongoDB ───────────────
    try {
      await Scan.findOneAndUpdate(
        { scanId: entry.scanId },
        {
          status: entry.status,
          completedAt: entry.completedAt,
          findings: entry.findings,
          vulnerabilityCount: entry.vulnerabilityCount,
          riskScore: entry.riskScore,
          bySeverity: entry.bySeverity,
          summary: entry.summary,
          logs: entry.logs,
        },
        { upsert: true }
      );
    } catch (dbErr) {
      console.error('[Scans] Failed to update scan in MongoDB:', dbErr.message);
    }

    // ─── Update User stats ────────────────────────────────
    try {
      await User.findByIdAndUpdate(userId, {
        $inc: {
          scansRun: 1,
          vulnerabilitiesFound: entry.vulnerabilityCount,
        },
        $set: { lastScan: new Date() },
      });
    } catch (dbErr) {
      console.error('[Scans] Failed to update user stats in MongoDB:', dbErr.message);
    }

  } catch (err) {
    entry.status = 'failed';
    entry.completedAt = new Date().toISOString();
    entry.logs.push({
      time: new Date().toISOString(),
      agent: 'SYSTEM',
      msg: `Scan failed: ${err.message}`,
    });

    // ─── Persist failed status to MongoDB ────────────────
    try {
      await Scan.findOneAndUpdate(
        { scanId: entry.scanId },
        {
          status: 'failed',
          completedAt: entry.completedAt,
          logs: entry.logs,
        },
        { upsert: true }
      );
    } catch (dbErr) {
      console.error('[Scans] Failed to update failed scan in MongoDB:', dbErr.message);
    }
  }
}

module.exports = router;
