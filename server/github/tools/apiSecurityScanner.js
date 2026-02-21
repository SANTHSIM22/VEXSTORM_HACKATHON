'use strict';

/**
 * API SECURITY SCANNER — standalone plain-JS (no LangChain)
 * Extracted from extension/tools/apiSecurityTools.js
 */

const API_PATTERNS = [
  { id: 'RATE-001', category: 'Missing Rate Limiting', severity: 'HIGH', pattern: /router\.post\s*\(\s*['"`](?:\/(?:login|auth|register|forgot|reset|verify|otp|sms|email))[^'"` ]*['"`]/gi, description: 'Auth endpoint defined — verify rate limiting is applied', cwe: 'CWE-307', owasp: 'A04:2021', poc: 'Brute-force login endpoint: for i in {1..10000}; do curl -X POST /auth/login ...; done', fix: 'Apply rate limiting: const limiter = rateLimit({ windowMs: 15*60*1000, max: 10 }); app.use("/auth", limiter);' },
  { id: 'DATA-EXP-001', category: 'Excessive Data Exposure', severity: 'HIGH', pattern: /res\.json\s*\(\s*(?:user|users|account|result|data)\s*\)/g, description: 'Entire DB object returned in response — may expose password, tokens, PII', cwe: 'CWE-213', owasp: 'A03:2021', poc: 'GET /api/users/me returns password hash, role, internal IDs', fix: 'Use projection/DTO: res.json({ id: user.id, email: user.email })' },
  { id: 'DATA-EXP-002', category: 'Excessive Data Exposure', severity: 'HIGH', pattern: /\.find\s*\([^)]*\)(?![\s\S]{0,100}\.select\s*\()/g, description: 'DB find() without .select() — all fields returned including sensitive ones', cwe: 'CWE-213', owasp: 'A03:2021', poc: 'Password hashes, tokens, and internal fields exposed in every query result', fix: 'Project sensitive fields out: User.find().select("-password -token -__v")' },
  { id: 'DATA-EXP-003', category: 'Excessive Data Exposure', severity: 'MEDIUM', pattern: /JSON\.stringify\s*\(\s*(?:req|request|error|err)\b/g, description: 'Request object or error object serialized to response — may leak internals', cwe: 'CWE-209', owasp: 'A05:2021', poc: 'Error response contains stack trace, file paths, env variables', fix: 'Return sanitized error: res.status(500).json({ error: "Internal Server Error" })' },
  { id: 'MASS-ASSIGN-001', category: 'Mass Assignment', severity: 'HIGH', pattern: /(?:new\s+\w+|create|update(?:One|Many)?)\s*\(\s*req\.body\s*\)/g, description: 'Entire req.body passed to DB create/update — mass assignment', cwe: 'CWE-915', owasp: 'A03:2021', poc: 'POST {"email":"x","role":"admin","isAdmin":true} — elevates privileges', fix: 'Destructure only allowed fields: const { email, name } = req.body;' },
  { id: 'MASS-ASSIGN-002', category: 'Mass Assignment', severity: 'HIGH', pattern: /Object\.assign\s*\(\s*\w+\s*,\s*req\.body\s*\)/g, description: 'Object.assign with req.body — uncontrolled field injection', cwe: 'CWE-915', owasp: 'A03:2021', poc: 'Inject arbitrary fields including admin flags', fix: 'Use explicit field allowlist instead of Object.assign with req.body' },
  { id: 'GQL-001', category: 'GraphQL Misconfiguration', severity: 'HIGH', pattern: /introspection\s*:\s*true/gi, description: 'GraphQL introspection enabled in production — schema exposed', cwe: 'CWE-200', owasp: 'A05:2021', poc: 'Query {__schema{types{name}}} to enumerate all types', fix: 'Disable introspection in production: introspection: process.env.NODE_ENV !== "production"' },
  { id: 'GQL-002', category: 'GraphQL Misconfiguration', severity: 'HIGH', pattern: /depth(?:Limit)?\s*:\s*(?:undefined|null|Infinity|999|100)/gi, description: 'No GraphQL query depth limit — nested query DoS attack', cwe: 'CWE-400', owasp: 'A04:2021', poc: '{ user { friends { friends { friends { id } } } } } (exponential)', fix: 'Use graphql-depth-limit: validate: [depthLimit(5)]' },
  { id: 'METHOD-001', category: 'HTTP Method Confusion', severity: 'MEDIUM', pattern: /app\.all\s*\(/g, description: 'app.all() accepts any HTTP method — may bypass method-specific auth', cwe: 'CWE-650', owasp: 'A01:2021', poc: 'Use HEAD, OPTIONS, or TRACE instead of GET to bypass method-specific middleware', fix: 'Use explicit method handlers: app.get(), app.post(), etc.' },
  { id: 'ERR-LEAK-001', category: 'Information Leakage', severity: 'MEDIUM', pattern: /res\.(?:send|json)\s*\(\s*(?:err|error|e)(?:\.message|\.stack)?\s*\)/g, description: 'Raw error/stack trace sent to client — information disclosure', cwe: 'CWE-209', owasp: 'A05:2021', poc: 'Trigger an error; stack trace reveals file paths, library versions', fix: 'res.status(500).json({ error: "Internal Server Error" })' },
  { id: 'ERR-LEAK-002', category: 'Information Leakage', severity: 'LOW', pattern: /x-powered-by/gi, description: 'X-Powered-By header may reveal technology stack', cwe: 'CWE-200', owasp: 'A05:2021', poc: 'HTTP response header X-Powered-By: Express reveals framework', fix: 'app.disable("x-powered-by") or use helmet()' },
  { id: 'VALID-001', category: 'Missing Input Validation', severity: 'MEDIUM', pattern: /(?:req\.body|req\.query|req\.params)(?![\s\S]{0,50}(?:validate|joi\.|Yup\.|zod\.|schema\.|sanitize|check\())/g, description: 'Request data used without apparent schema validation', cwe: 'CWE-20', owasp: 'A03:2021', poc: 'Inject malformed data that bypasses application logic', fix: 'Validate with Joi/Zod: const { error } = schema.validate(req.body); if (error) return 400;' },
];

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}
function getLineContent(content, lineNum) {
  return (content.split('\n')[lineNum - 1] || '').trim().slice(0, 140);
}

function scanApiSecurity(filePath, content) {
  const findings = [];
  for (const vuln of API_PATTERNS) {
    const regex = new RegExp(vuln.pattern.source, vuln.pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lineNum = getLineNumber(content, match.index);
      findings.push({ ruleId: vuln.id, category: vuln.category, severity: vuln.severity, description: vuln.description, cwe: vuln.cwe, owasp: vuln.owasp, poc: vuln.poc || '', fix: vuln.fix || '', file: filePath, line: lineNum, snippet: getLineContent(content, lineNum), match: match[0].slice(0, 120), source: 'API Security' });
    }
  }
  return { file: filePath, findingsCount: findings.length, findings };
}

function checkSecurityHeaders(files) {
  const issues = [];
  const mainFiles = files.filter(f => /(?:index|app|server)\.[jt]s$/.test(f.filePath));
  for (const file of mainFiles) {
    const content = file.content;
    if (!/require\s*\(\s*['"]helmet['"]\s*\)|import\s+helmet/.test(content)) {
      issues.push({ file: file.filePath, severity: 'HIGH', category: 'Missing Security Headers', description: 'helmet not found — missing 12 security headers', fix: 'npm install helmet; app.use(helmet())', source: 'API Security', cwe: 'CWE-693', owasp: 'A05:2021' });
    }
    if (/cors\s*\(\s*\{[^}]*origin\s*:\s*['"]?\*['"]?/.test(content)) {
      issues.push({ file: file.filePath, severity: 'HIGH', category: 'Security Misconfiguration', description: 'CORS allows all origins (*) — CSRF risk', fix: 'Specify exact origins: cors({ origin: process.env.ALLOWED_ORIGIN })', source: 'API Security', cwe: 'CWE-942', owasp: 'A05:2021' });
    }
  }
  return { issues };
}

module.exports = { scanApiSecurity, checkSecurityHeaders, API_PATTERNS };
