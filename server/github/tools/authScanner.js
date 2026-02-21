'use strict';

/**
 * AUTH SCANNER — standalone plain-JS (no LangChain)
 * Extracted from extension/tools/authAnalysisTools.js
 */

const AUTH_PATTERNS = [
  { id: 'IDOR-001', category: 'IDOR', severity: 'HIGH', pattern: /(?:findById|findOne|find)\s*\([^)]*(?:req\.params\.|req\.query\.|req\.body\.)(id|userId|user_id)/gi, description: 'DB query uses request-supplied ID without ownership check — IDOR', cwe: 'CWE-639', owasp: 'A01:2021', poc: 'GET /api/users/1 (authenticated as user ID 2) — returns victim data', fix: 'Add ownership check: if (resource.userId !== req.user.id) return res.status(403).json({error:"Forbidden"});' },
  { id: 'IDOR-002', category: 'IDOR', severity: 'HIGH', pattern: /(?:params|query)\.(id|userId|user_id|accountId|orderId|invoiceId)\b(?!.*(?:auth|user\.id|userId\s*===|\.id\s*===|owner))/gi, description: 'Object ID from request params used without apparent ownership validation', cwe: 'CWE-639', owasp: 'A01:2021', poc: 'Enumerate numeric IDs to access other users resources', fix: 'Always verify resource ownership before returning data' },
  { id: 'AUTH-001', category: 'Missing Authentication', severity: 'CRITICAL', pattern: /router\.(?:get|post|put|patch|delete)\s*\(\s*['"`][^'"` ]+['"`]\s*,\s*(?!.*(?:auth|protect|authenticate|requireAuth|verifyToken|isAuthenticated|middleware))/g, description: 'Route handler defined without visible authentication middleware', cwe: 'CWE-306', owasp: 'A01:2021', poc: 'Access /api/sensitive without any Authorization header', fix: 'Add auth middleware: router.get("/route", authenticate, handler)' },
  { id: 'AUTH-002', category: 'Missing Authentication', severity: 'HIGH', pattern: /app\.(?:get|post|put|delete)\s*\(\s*['"`]\/(?:admin|dashboard|settings|profile|account|payment)[^'"`) ]*['"`]\s*,\s*(?!.*(?:auth|protect|authenticate|isAuth))/g, description: 'Admin/sensitive route without apparent auth guard', cwe: 'CWE-306', owasp: 'A01:2021', poc: 'Navigate to /admin without logging in', fix: 'Protect all admin routes with role-based authentication middleware' },
  { id: 'PRIV-001', category: 'Privilege Escalation', severity: 'CRITICAL', pattern: /req\.body\.(?:role|isAdmin|admin|privilege|permission)\b/g, description: 'User-supplied role/privilege field used from request body — privilege escalation', cwe: 'CWE-269', owasp: 'A01:2021', poc: 'POST /api/users/update {"role":"admin"} — bypasses authorization', fix: 'Never trust role/privilege from req.body. Fetch from DB using authenticated user session.' },
  { id: 'PRIV-002', category: 'Privilege Escalation', severity: 'HIGH', pattern: /Object\.assign\s*\([^)]*req\.body/g, description: 'req.body spread into user object — mass assignment may elevate privileges', cwe: 'CWE-915', owasp: 'A01:2021', poc: 'POST {"role":"admin","isAdmin":true} — sets privileged fields', fix: 'Allowlist fields: const { name, email } = req.body;' },
  { id: 'CSRF-001', category: 'CSRF', severity: 'HIGH', pattern: /(?:app|router)\.use\s*\([^)]*\bcsrf\b/g, description: 'CSRF protection middleware detected — verify it covers all state-changing routes', cwe: 'CWE-352', owasp: 'A01:2021', poc: 'N/A (informational)', fix: 'Verify CSRF middleware covers all POST/PUT/DELETE routes' },
  { id: 'CSRF-002', category: 'CSRF', severity: 'HIGH', pattern: /sameSite\s*:\s*['"]?(?:none|false)['"]?/gi, description: 'Cookie SameSite set to None/false — CSRF via cross-origin requests', cwe: 'CWE-352', owasp: 'A01:2021', poc: 'Create a cross-origin POST form; cookie sent automatically', fix: 'Set sameSite: "strict" or "lax" on all session cookies' },
  { id: 'JWT-ALG-NONE', category: 'Broken Authentication', severity: 'CRITICAL', pattern: /algorithms?\s*:\s*\[[^\]]*['"]none['"]/gi, description: 'JWT accepts "none" algorithm — authentication bypass possible', cwe: 'CWE-347', owasp: 'A07:2021', poc: 'Craft JWT with alg:none header', fix: 'jwt.verify(token, secret, { algorithms: ["HS256"] })' },
  { id: 'JWT-NO-EXPIRY', category: 'Broken Authentication', severity: 'HIGH', pattern: /jwt\.sign\s*\([^)]+\)(?![\s\S]{0,200}expiresIn)/g, description: 'JWT signed without expiresIn — tokens never expire', cwe: 'CWE-613', owasp: 'A07:2021', poc: 'Stolen JWT valid forever', fix: 'Add expiresIn: jwt.sign(payload, secret, { expiresIn: "1h" })' },
  { id: 'JWT-WEAK-SECRET', category: 'Broken Authentication', severity: 'CRITICAL', pattern: /jwt\.sign\s*\([^,]+,\s*['"][^'"]{1,15}['"]/g, description: 'JWT secret appears to be very short (< 16 chars) — brute-forceable', cwe: 'CWE-521', owasp: 'A07:2021', poc: 'Brute-force the JWT secret offline using hashcat', fix: 'Use a cryptographically random secret of at least 256 bits' },
  { id: 'SESS-001', category: 'Session Fixation', severity: 'HIGH', pattern: /req\.session\.(?:userId|user|id)\s*=.*(?:req\.|body\.|params\.)/g, description: 'Session ID or user data set from request — session fixation risk', cwe: 'CWE-384', owasp: 'A07:2021', poc: 'Attacker fixes session ID; after victim login they use same session', fix: 'Regenerate session ID after authentication: req.session.regenerate()' },
  { id: 'SESS-002', category: 'Insecure Session', severity: 'HIGH', pattern: /secret\s*:\s*['"](?:secret|keyboard cat|express_session|changeme|default)['"]/gi, description: 'Hardcoded/default express-session secret detected', cwe: 'CWE-798', owasp: 'A07:2021', poc: 'Forge session cookies using the known secret', fix: 'Use a strong random secret from environment: secret: process.env.SESSION_SECRET' },
  { id: 'PWD-001', category: 'Weak Password Policy', severity: 'MEDIUM', pattern: /bcrypt\.hash\s*\([^,]+,\s*[1-9]\s*\)/g, description: 'bcrypt cost factor may be too low (< 10 is weak)', cwe: 'CWE-916', owasp: 'A02:2021', poc: 'Low work-factor allows rapid offline password cracking', fix: 'Use bcrypt cost factor >= 12: bcrypt.hash(password, 12)' },
  { id: 'PWD-002', category: 'Weak Password Policy', severity: 'MEDIUM', pattern: /password\.length\s*[<>]=?\s*[1-5]\b/g, description: 'Password minimum length check is very weak (< 6 chars)', cwe: 'CWE-521', owasp: 'A07:2021', poc: 'Users can set 1-character passwords', fix: 'Enforce minimum 12 characters with complexity requirements' },
  { id: 'TIME-001', category: 'Timing Attack', severity: 'MEDIUM', pattern: /password\s*===\s*(?:req\.|body\.|input\.)/gi, description: 'Password compared with === — vulnerable to timing attacks', cwe: 'CWE-208', owasp: 'A02:2021', poc: 'Measure response times to guess correct password byte by byte', fix: 'Use crypto.timingSafeEqual() for constant-time comparison' },
  { id: 'BYPASS-001', category: 'Hardcoded Bypass', severity: 'CRITICAL', pattern: /(?:username|user|email)\s*===?\s*['"](?:admin|root|superuser|test|dev)['"]/gi, description: 'Hardcoded admin/backdoor username comparison detected', cwe: 'CWE-798', owasp: 'A07:2021', poc: 'Log in with username "admin" / "root" to trigger hardcoded bypass', fix: 'Remove all hardcoded credentials.' },
];

const RBAC_PATTERNS = [
  { re: /req\.body\.role\b/g,         msg: 'Role taken from req.body — attacker can set own role' },
  { re: /req\.query\.role\b/g,        msg: 'Role taken from query string' },
  { re: /req\.headers.*role\b/gi,     msg: 'Role taken from custom header' },
  { re: /user\.isAdmin\s*=\s*true/g,  msg: 'isAdmin set to true statically without verification' },
];

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}
function getLineContent(content, lineNum) {
  return (content.split('\n')[lineNum - 1] || '').trim().slice(0, 140);
}

function scanAuth(filePath, content) {
  const findings = [];
  for (const vuln of AUTH_PATTERNS) {
    const regex = new RegExp(vuln.pattern.source, vuln.pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lineNum = getLineNumber(content, match.index);
      findings.push({ ruleId: vuln.id, category: vuln.category, severity: vuln.severity, description: vuln.description, cwe: vuln.cwe, owasp: vuln.owasp, poc: vuln.poc || '', fix: vuln.fix || '', file: filePath, line: lineNum, snippet: getLineContent(content, lineNum), match: match[0].slice(0, 120), source: 'Auth Analysis' });
    }
  }
  // RBAC check
  for (const { re, msg } of RBAC_PATTERNS) {
    const regex = new RegExp(re.source, re.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lineNum = getLineNumber(content, match.index);
      findings.push({ ruleId: 'RBAC-001', category: 'Broken Access Control', severity: 'HIGH', description: msg, cwe: 'CWE-269', owasp: 'A01:2021', poc: 'POST with {"role":"admin"} to bypass role check', fix: 'Always fetch user role from DB using authenticated session token', file: filePath, line: lineNum, snippet: getLineContent(content, lineNum), source: 'Auth Analysis' });
    }
  }
  return { file: filePath, findingsCount: findings.length, findings };
}

function detectMissingAuth(files) {
  const exposedRoutes = [];
  const routePattern = /(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"` ]+)['"`]/g;
  const authIndicators = /\b(?:auth|protect|authenticate|requireAuth|verifyToken|isAuthenticated|checkToken|jwtMiddleware|passport\.authenticate)\b/;
  for (const file of files) {
    const lines = file.content.split('\n');
    const regex = new RegExp(routePattern.source, routePattern.flags);
    let match;
    while ((match = regex.exec(file.content)) !== null) {
      const lineNum = getLineNumber(file.content, match.index);
      const context = lines.slice(Math.max(0, lineNum - 2), lineNum + 3).join(' ');
      if (!authIndicators.test(context)) {
        exposedRoutes.push({ file: file.filePath, line: lineNum, method: match[1].toUpperCase(), route: match[2], snippet: (lines[lineNum - 1] || '').trim().slice(0, 120), severity: (match[2].includes('admin') || match[2].includes('user')) ? 'HIGH' : 'MEDIUM', category: 'Missing Authentication', cwe: 'CWE-306', owasp: 'A01:2021', source: 'Auth Analysis' });
      }
    }
  }
  return { totalExposedRoutes: exposedRoutes.length, routes: exposedRoutes };
}

module.exports = { scanAuth, detectMissingAuth, AUTH_PATTERNS };
