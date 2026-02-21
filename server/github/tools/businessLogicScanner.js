'use strict';

/**
 * BUSINESS LOGIC SCANNER — standalone plain-JS (no LangChain)
 * Extracted from extension/tools/businessLogicTools.js
 */

const BIZ_PATTERNS = [
  { id: 'RACE-001', category: 'Race Condition', severity: 'HIGH', pattern: /findOne\s*\([^)]+\)[\s\S]{0,300}save\s*\(/g, description: 'Read-then-write without DB transaction — race condition (TOCTOU)', cwe: 'CWE-362', owasp: 'A04:2021', poc: 'Concurrent requests can both pass the "check" before either triggers "act"', fix: 'Use DB-level atomic operations: findOneAndUpdate with $inc, or wrap in a transaction' },
  { id: 'RACE-002', category: 'Race Condition', severity: 'HIGH', pattern: /balance\s*[-+]=?\s*(?:amount|value|price|cost)/g, description: 'Balance arithmetic without atomic DB update — double-spend race condition', cwe: 'CWE-362', owasp: 'A04:2021', poc: 'Send two concurrent withdrawal requests for the same balance', fix: 'Use $inc: User.updateOne({_id}, {$inc: {balance: -amount}}) — atomic operation' },
  { id: 'PRICE-001', category: 'Price Manipulation', severity: 'CRITICAL', pattern: /(?:price|amount|total|cost)\s*[=:]\s*(?:req\.body\.|req\.query\.|params\.)/gi, description: 'Price/amount taken directly from user request — price manipulation', cwe: 'CWE-20', owasp: 'A04:2021', poc: 'POST /checkout {"price": 0.01} — buy for any amount attacker chooses', fix: 'NEVER trust price from client. Always compute server-side from product ID.' },
  { id: 'PRICE-002', category: 'Price Manipulation', severity: 'HIGH', pattern: /quantity\s*\*\s*(?:req\.|body\.|query\.)/gi, description: 'Quantity multiplied with client-supplied price — price bypass', cwe: 'CWE-20', owasp: 'A04:2021', poc: 'POST {"quantity": 1, "price": -100} — negative price = credit', fix: 'Fetch canonical price from DB' },
  { id: 'COUPON-001', category: 'Business Logic Bypass', severity: 'HIGH', pattern: /coupon(?:Code)?\s*(?:===?|!==?)\s*(?:req\.|body\.|query\.)/gi, description: 'Coupon code checked without verifying single-use or user binding', cwe: 'CWE-20', owasp: 'A04:2021', poc: 'Reuse same coupon code multiple times', fix: 'Mark coupon as used atomically; bind coupon to userId; enforce one-per-account' },
  { id: 'STATE-001', category: 'State Machine Bypass', severity: 'HIGH', pattern: /status\s*[=:]\s*(?:req\.body\.|req\.query\.|params\.)/gi, description: 'Object status/state taken from user input — workflow bypass', cwe: 'CWE-840', owasp: 'A04:2021', poc: 'PATCH /orders/1 {"status":"completed"} — mark unpaid order as paid', fix: 'Enforce state machine server-side. Only allow valid transitions from current state.' },
  { id: 'STATE-002', category: 'State Machine Bypass', severity: 'MEDIUM', pattern: /(?:step|stage|phase)\s*[=:]\s*(?:req\.body\.|parseInt\(req\.|Number\(req\.)/gi, description: 'Workflow step/stage supplied by client — can skip steps', cwe: 'CWE-840', owasp: 'A04:2021', poc: 'Jump directly to final step without completing prerequisite steps', fix: 'Track workflow progress server-side in DB session, never trust client step counter' },
  { id: 'NEG-001', category: 'Negative Value Attack', severity: 'HIGH', pattern: /(?:quantity|amount|count|limit)\s*[=:]\s*(?:parseInt|Number|parseFloat)\s*\(\s*(?:req\.|body\.|query\.)/gi, description: 'Numeric value from request without bounds check — negative value attack', cwe: 'CWE-20', owasp: 'A04:2021', poc: 'Send {"quantity":-1} to potentially earn credits or bypass stock checks', fix: 'Validate: if (quantity <= 0 || quantity > MAX_ALLOWED) return 400;' },
  { id: 'LOCK-001', category: 'Race Condition', severity: 'MEDIUM', pattern: /Promise\.all\s*\(\s*\[[^\]]*(?:save|update|insert|create)/g, description: 'Parallel DB writes without locks — concurrent modification risk', cwe: 'CWE-362', owasp: 'A04:2021', poc: 'Concurrent requests complete without one blocking the other', fix: 'Use optimistic locking (versionKey), pessimistic locks, or queued operations' },
  { id: 'UNLIM-001', category: 'Resource Exhaustion', severity: 'MEDIUM', pattern: /for\s*\([^)]*(?:req\.|body\.|query\.)[^)]*\)/g, description: 'Loop iterates over user-supplied collection — unbounded resource allocation', cwe: 'CWE-770', owasp: 'A04:2021', poc: 'Send array with 100,000 items to exhaust CPU/memory', fix: 'Limit input array length: if (items.length > 100) return 400;' },
  { id: 'UNLIM-002', category: 'Resource Exhaustion', severity: 'MEDIUM', pattern: /\.find\s*\(\s*\{?\s*\}?\s*\)(?!.*(?:limit|skip|take|top))/g, description: 'Unbounded DB query without LIMIT — potential DoS via data dump', cwe: 'CWE-770', owasp: 'A04:2021', poc: 'Trigger query returning millions of records', fix: 'Always paginate: Model.find().limit(100).skip(offset)' },
  { id: 'PRED-001', category: 'Insecure Direct Object Reference', severity: 'MEDIUM', pattern: /(?:invoiceNumber|orderId|ticketId|receiptId)\s*[=:]\s*(?:Date\.now|new Date|Math\.random)/gi, description: 'Resource ID generated with predictable timestamp/random — IDOR via enumeration', cwe: 'CWE-330', owasp: 'A01:2021', poc: 'Enumerate invoice/order numbers by incrementing known IDs', fix: 'Use UUIDs: const id = require("crypto").randomUUID()' },
];

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}
function getLineContent(content, lineNum) {
  return (content.split('\n')[lineNum - 1] || '').trim().slice(0, 140);
}

function scanBusinessLogic(filePath, content) {
  const findings = [];
  for (const vuln of BIZ_PATTERNS) {
    const regex = new RegExp(vuln.pattern.source, vuln.pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lineNum = getLineNumber(content, match.index);
      findings.push({ ruleId: vuln.id, category: vuln.category, severity: vuln.severity, description: vuln.description, cwe: vuln.cwe, owasp: vuln.owasp, poc: vuln.poc || '', fix: vuln.fix || '', file: filePath, line: lineNum, snippet: getLineContent(content, lineNum), match: match[0].slice(0, 120), source: 'Business Logic' });
    }
  }
  return { file: filePath, findingsCount: findings.length, findings };
}

function auditStateTransitions(files) {
  const issues = [];
  const statePattern = /(?:status|state|phase|step)\s*[=:]\s*(?:req\.|body\.|query\.)[^\n;,}]*/gi;
  for (const file of files) {
    let match;
    const regex = new RegExp(statePattern.source, statePattern.flags);
    while ((match = regex.exec(file.content)) !== null) {
      const lineNum = getLineNumber(file.content, match.index);
      const context = file.content.slice(Math.max(0, match.index - 200), match.index + 200);
      const hasValidation = /(?:validTransitions|allowedStates|canTransition|switch\s*\(|if\s*\(.*status)/.test(context);
      if (!hasValidation) {
        issues.push({ file: file.filePath, line: lineNum, severity: 'HIGH', category: 'State Machine Bypass', description: 'Status/state updated from user input without transition validation', snippet: getLineContent(file.content, lineNum), cwe: 'CWE-840', owasp: 'A04:2021', source: 'Business Logic', poc: 'Send arbitrary status value to skip workflow steps', fix: 'Define allowed transitions and validate before updating' });
      }
    }
  }
  return { totalIssues: issues.length, issues };
}

module.exports = { scanBusinessLogic, auditStateTransitions, BIZ_PATTERNS };
