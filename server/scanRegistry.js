// ──────────────────────────────────────────────
// In-memory Scan Registry (Task 2)
// Tracks active and completed scans keyed by scanId
// ──────────────────────────────────────────────

const scanRegistry = new Map();

function createScanEntry(scanId, targetUrl, userId, scanName = '') {
  const entry = {
    scanId,
    targetUrl,
    scanName,
    userId,
    status: 'running',
    createdAt: new Date().toISOString(),
    completedAt: null,
    logs: [],
    findings: [],
    vulnerabilityCount: 0,
    riskScore: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    summary: null,
    report: null,
  };
  scanRegistry.set(scanId, entry);
  return entry;
}

function getScanEntry(scanId) {
  return scanRegistry.get(scanId) || null;
}

function getAllScans(userId) {
  const results = [];
  for (const entry of scanRegistry.values()) {
    if (!userId || entry.userId === userId) {
      results.push(entry);
    }
  }
  return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = { scanRegistry, createScanEntry, getScanEntry, getAllScans };
