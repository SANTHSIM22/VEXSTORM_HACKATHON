// ──────────────────────────────────────────────
// Extension Routes — /api/extension
// Lets the VS Code ZeroTrace extension push
// HTML reports to the backend and retrieve them.
// ──────────────────────────────────────────────

const express = require('express');
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const { protect } = require('../middleware/auth');
const Scan = require('../models/Scan');
const User = require('../models/User');

const router = express.Router();

// ─── POST /api/extension/reports ─────────────────
// Body: { htmlReport, targetPath, summary, bySeverity }
// summary shape: { riskLevel, totalFindings, bySeverity }
router.post('/reports', protect, async (req, res) => {
  const { htmlReport, targetPath, summary, bySeverity } = req.body;

  if (!htmlReport || !targetPath) {
    return res.status(400).json({ message: 'htmlReport and targetPath are required' });
  }

  const scanId   = crypto.randomUUID();
  const sev      = bySeverity || summary?.bySeverity || {};
  const riskLevel  = summary?.riskLevel  || 'UNKNOWN';
  const totalFindings = summary?.totalFindings ?? 0;

  const riskScore =
    riskLevel === 'CRITICAL' ? 9.5 :
    riskLevel === 'HIGH'     ? 7.5 :
    riskLevel === 'MEDIUM'   ? 5.0 :
    riskLevel === 'LOW'      ? 2.0 : 0;

  // Normalise severity keys (extension sends upper-case, model stores lower-case)
  const normSev = {
    critical: sev.CRITICAL ?? sev.critical ?? 0,
    high:     sev.HIGH     ?? sev.high     ?? 0,
    medium:   sev.MEDIUM   ?? sev.medium   ?? 0,
    low:      sev.LOW      ?? sev.low      ?? 0,
    info:     sev.INFO     ?? sev.info     ?? 0,
  };

  try {
    await Scan.create({
      scanId,
      userId:             req.user._id,
      targetUrl:          targetPath,   // reuse targetUrl so existing queries still work
      targetPath,
      source:             'extension',
      status:             'completed',
      htmlReport,
      summary:            summary || { riskLevel, totalFindings },
      vulnerabilityCount: totalFindings,
      bySeverity:         normSev,
      riskScore,
      createdAt:          new Date().toISOString(),
      completedAt:        new Date().toISOString(),
    });

    // Update user stats
    try {
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { scansRun: 1, vulnerabilitiesFound: totalFindings },
        $set: { lastScan: new Date() },
      });
    } catch (_) { /* non-fatal */ }

    res.status(201).json({ scanId, message: 'Report saved successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ─── GET /api/extension/reports ──────────────────
// List all extension reports for the current user
router.get('/reports', protect, async (req, res) => {
  try {
    const docs = await Scan.find({ userId: req.user._id, source: 'extension' })
      .sort({ createdAt: -1 })
      .select('-htmlReport')   // don't send full HTML in list
      .lean();

    res.json(docs.map((d) => ({
      scanId:             d.scanId,
      targetPath:         d.targetPath || d.targetUrl,
      status:             d.status,
      riskScore:          d.riskScore,
      vulnerabilityCount: d.vulnerabilityCount,
      bySeverity:         d.bySeverity,
      summary:            d.summary,
      createdAt:          d.createdAt,
      completedAt:        d.completedAt,
    })));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ─── GET /api/extension/reports/:scanId/html ─────
// Serve the raw HTML report (displayed in an iframe or browser tab).
// Accepts auth either via Authorization: Bearer header OR ?token= query param
// so the URL can be opened directly in a browser without JS.
router.get('/reports/:scanId/html', async (req, res) => {
  // Resolve token from header or query string
  let token = null;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).send('<h3 style="font-family:sans-serif;color:#f87171">Not authorized — no token supplied.<br>Open this page from the ZeroTrace Dashboard.</h3>');
  }

  let userId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.id;
  } catch {
    return res.status(401).send('<h3 style="font-family:sans-serif;color:#f87171">Token invalid or expired.</h3>');
  }

  try {
    const doc = await Scan.findOne({
      scanId:  req.params.scanId,
      userId,
      source:  'extension',
    }).select('htmlReport').lean();

    if (!doc) return res.status(404).send('<h3 style="font-family:sans-serif;color:#f87171">Report not found.</h3>');
    if (!doc.htmlReport) return res.status(404).send('<h3 style="font-family:sans-serif;color:#f87171">HTML report body is empty.</h3>');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(doc.htmlReport);
  } catch (err) {
    res.status(500).send(`<h3 style="font-family:sans-serif;color:#f87171">Server error: ${err.message}</h3>`);
  }
});

// ─── DELETE /api/extension/reports/:scanId ─────────
// Permanently remove an extension report from the DB.
router.delete('/reports/:scanId', protect, async (req, res) => {
  try {
    const deleted = await Scan.findOneAndDelete({
      scanId: req.params.scanId,
      userId: req.user._id,
      source: 'extension',
    });
    if (!deleted) return res.status(404).json({ message: 'Report not found' });
    res.json({ message: 'Report deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

module.exports = router;
