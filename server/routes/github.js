// ──────────────────────────────────────────────
// GitHub Scan Routes — /api/github
// Accepts a GitHub repo URL, runs the full
// multi-agent security scan, stores results.
// ──────────────────────────────────────────────

'use strict';

const express    = require('express');
const crypto     = require('crypto');
const { protect } = require('../middleware/auth');
const GithubScan = require('../models/GithubScan');
const User       = require('../models/User');
const { MISTRAL_API_KEY } = require('../config');
const { runGithubSecurityScan } = require('../github/orchestratorAgent');

const router = express.Router();

// In-memory progress registry for live polling (scanId → { stage, message, logs[] })
const githubScanProgress = new Map();

// ─── POST /api/github/scan — Start a new GitHub scan ─────────────────────────
router.post('/scan', protect, async (req, res) => {
  const { repoUrl, branch, githubToken } = req.body;

  if (!repoUrl || !repoUrl.trim()) {
    return res.status(400).json({ message: 'repoUrl is required' });
  }

  const scanId    = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // Persist initial document
  try {
    await GithubScan.create({
      scanId,
      userId:    req.user._id,
      repoUrl:   repoUrl.trim(),
      branch:    branch || null,
      status:    'running',
      createdAt,
    });
  } catch (dbErr) {
    console.error('[GithubRoutes] Failed to persist scan:', dbErr.message);
    return res.status(500).json({ message: 'Failed to create scan record' });
  }

  // Initialise in-memory progress
  githubScanProgress.set(scanId, {
    scanId,
    status:  'running',
    stage:   'Starting',
    message: 'Initializing...',
    logs:    [],
  });

  // Respond immediately
  res.status(201).json({ scanId, status: 'running', repoUrl: repoUrl.trim(), createdAt });

  // ── Background scan ──────────────────────────────────────────────────────
  (async () => {
    const progress = githubScanProgress.get(scanId);
    try {
      const result = await runGithubSecurityScan({
        repoUrl:  repoUrl.trim(),
        branch,
        token:    githubToken || '',
        apiKey:   MISTRAL_API_KEY,
        model:    'mistral-large-latest',
        onProgress: ({ stage, message }) => {
          progress.stage   = stage;
          progress.message = message;
          progress.logs.push(`[${new Date().toISOString()}] [${stage}] ${message}`);
        },
      });

      // Compute stats
      const sev   = result.reportJson?.summary?.bySeverity || {};
      const normSev = {
        critical: sev.CRITICAL ?? sev.critical ?? 0,
        high:     sev.HIGH     ?? sev.high     ?? 0,
        medium:   sev.MEDIUM   ?? sev.medium   ?? 0,
        low:      sev.LOW      ?? sev.low      ?? 0,
        info:     sev.INFO     ?? sev.info     ?? 0,
      };
      const totalFindings = result.reportJson?.summary?.totalFindings ?? 0;
      const riskScore     = result.reportJson?.summary?.riskScore     ?? 0;
      const completedAt   = new Date().toISOString();

      // Normalise risk score to 0-10 range (extension uses 0-100)
      const normRiskScore = riskScore > 10 ? riskScore / 10 : riskScore;

      // Update MongoDB
      await GithubScan.findOneAndUpdate({ scanId }, {
        status:             result.status === 'failed' ? 'failed' : 'completed',
        currentStage:       'done',
        htmlReport:         result.htmlReport  || null,
        reportJson:         result.reportJson  || null,
        executiveSummary:   result.executiveSummary || null,
        vulnerabilityCount: totalFindings,
        riskScore:          normRiskScore,
        bySeverity:         normSev,
        repoMeta: {
          owner:       result.reportJson?.meta?.owner       || '',
          repo:        result.reportJson?.meta?.repo        || '',
          language:    result.reportJson?.meta?.language    || '',
          description: result.reportJson?.meta?.description || '',
          stars:       result.reportJson?.meta?.stars       || 0,
          isPrivate:   result.reportJson?.meta?.private     || false,
        },
        agentLogs:  result.agentLogs || [],
        errors:     result.errors    || [],
        completedAt,
      });

      // Update user stats
      try {
        await User.findByIdAndUpdate(req.user._id, {
          $inc: { scansRun: 1, vulnerabilitiesFound: totalFindings },
          $set: { lastScan: new Date() },
        });
      } catch (_) { /* non-fatal */ }

      // Update in-memory progress
      progress.status  = 'completed';
      progress.stage   = 'Complete';
      progress.message = `Scan finished — ${totalFindings} vulnerabilities found`;

    } catch (err) {
      console.error(`[GithubScan ${scanId}] Error:`, err.message);

      await GithubScan.findOneAndUpdate({ scanId }, {
        status:       'failed',
        errors:       [err.message],
        completedAt:  new Date().toISOString(),
        agentLogs:    progress.logs,
      }).catch(() => {});

      progress.status  = 'failed';
      progress.stage   = 'Error';
      progress.message = err.message;
    }
  })();
});

// ─── GET /api/github/scans — List user's GitHub scans ────────────────────────
router.get('/scans', protect, async (req, res) => {
  try {
    const docs = await GithubScan.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('-htmlReport -reportJson -agentLogs')
      .lean();

    // Merge live progress for running scans
    const merged = docs.map((doc) => {
      const prog = githubScanProgress.get(doc.scanId);
      if (prog && doc.status === 'running') {
        return { ...doc, currentStage: prog.stage, progressMessage: prog.message };
      }
      return doc;
    });

    res.json(merged);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/github/scans/:scanId — Get scan details ────────────────────────
router.get('/scans/:scanId', protect, async (req, res) => {
  try {
    const doc = await GithubScan.findOne({
      scanId: req.params.scanId,
      userId: req.user._id,
    }).select('-htmlReport').lean();

    if (!doc) return res.status(404).json({ message: 'Scan not found' });

    // Merge live progress
    const prog = githubScanProgress.get(doc.scanId);
    if (prog && doc.status === 'running') {
      return res.json({
        ...doc,
        currentStage:    prog.stage,
        progressMessage: prog.message,
        liveLogs:        prog.logs.slice(-50),
      });
    }

    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/github/scans/:scanId/html — Get HTML report ────────────────────
router.get('/scans/:scanId/html', async (req, res) => {
  // Support token query param (for iframe / direct link)
  const jwt = require('jsonwebtoken');
  let userId;
  try {
    const token   = req.headers.authorization?.split(' ')[1] || req.query.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId        = decoded.id;
  } catch {
    return res.status(401).send('Unauthorized');
  }

  try {
    const doc = await GithubScan.findOne({ scanId: req.params.scanId, userId }).select('htmlReport status').lean();
    if (!doc)            return res.status(404).send('Scan not found');
    if (!doc.htmlReport) return res.status(404).send('HTML report not available yet');
    res.setHeader('Content-Type', 'text/html');
    res.send(doc.htmlReport);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ─── DELETE /api/github/scans/:scanId — Delete a scan ────────────────────────
router.delete('/scans/:scanId', protect, async (req, res) => {
  try {
    const doc = await GithubScan.findOneAndDelete({
      scanId: req.params.scanId,
      userId: req.user._id,
    });
    if (!doc) return res.status(404).json({ message: 'Scan not found' });
    githubScanProgress.delete(req.params.scanId);
    res.json({ message: 'Scan deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
