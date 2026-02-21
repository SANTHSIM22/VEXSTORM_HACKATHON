/**
 * API SECURITY TOOLS
 * Detects API-specific vulnerabilities:
 * Rate limiting absence, mass assignment, excessive data exposure,
 * GraphQL introspection, replay attacks, HTTP method confusion.
 */

'use strict';

const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');

const API_PATTERNS = [
  // ── Missing Rate Limiting ─────────────────────────────────────────────────
  {
    id: 'RATE-001', category: 'Missing Rate Limiting', severity: 'HIGH',
    pattern: /router\.post\s*\(\s*['"`](?:\/(?:login|auth|register|forgot|reset|verify|otp|sms|email))[^'"` ]*['"`]/gi,
    description: 'Auth endpoint defined — verify rate limiting is applied',
    cwe: 'CWE-307', owasp: 'A04:2021',
    poc: 'Brute-force login endpoint: for i in {1..10000}; do curl -X POST /auth/login ...; done',
    fix: 'Apply rate limiting: const limiter = rateLimit({ windowMs: 15*60*1000, max: 10 }); app.use("/auth", limiter);',
  },
  {
    id: 'RATE-002', category: 'Missing Rate Limiting', severity: 'MEDIUM',
    pattern: /(?:app|router)\.use\s*\([^)]*(?:express\.Router|require\('express'\))\s*\(\s*\)(?![\s\S]{0,1000}rateLimit)/g,
    description: 'Express router without apparent rate limit middleware',
    cwe: 'CWE-307', owasp: 'A04:2021',
    poc: 'DoS by sending thousands of requests, or brute-forcing auth',
    fix: 'npm install express-rate-limit; apply to sensitive routes',
  },

  // ── Excessive Data Exposure ───────────────────────────────────────────────
  {
    id: 'DATA-EXP-001', category: 'Excessive Data Exposure', severity: 'HIGH',
    pattern: /res\.json\s*\(\s*(?:user|users|account|result|data)\s*\)/g,
    description: 'Entire DB object returned in response — may expose password, tokens, PII',
    cwe: 'CWE-213', owasp: 'A03:2021',
    poc: 'GET /api/users/me returns password hash, role, internal IDs',
    fix: 'Use projection/DTO: res.json({ id: user.id, email: user.email }) — never spread full model',
  },
  {
    id: 'DATA-EXP-002', category: 'Excessive Data Exposure', severity: 'HIGH',
    pattern: /\.find\s*\([^)]*\)(?![\s\S]{0,100}\.select\s*\()/g,
    description: 'DB find() without .select() — all fields returned including sensitive ones',
    cwe: 'CWE-213', owasp: 'A03:2021',
    poc: 'Password hashes, tokens, and internal fields exposed in every query result',
    fix: 'Project sensitive fields out: User.find().select("-password -token -__v")',
  },
  {
    id: 'DATA-EXP-003', category: 'Excessive Data Exposure', severity: 'MEDIUM',
    pattern: /JSON\.stringify\s*\(\s*(?:req|request|error|err)\b/g,
    description: 'Request object or error object serialized to response — may leak internals',
    cwe: 'CWE-209', owasp: 'A05:2021',
    poc: 'Error response contains stack trace, file paths, env variables',
    fix: 'Return sanitized error: res.status(500).json({ error: "Internal Server Error" })',
  },

  // ── Mass Assignment ───────────────────────────────────────────────────────
  {
    id: 'MASS-ASSIGN-001', category: 'Mass Assignment', severity: 'HIGH',
    pattern: /(?:new\s+\w+|create|update(?:One|Many)?)\s*\(\s*req\.body\s*\)/g,
    description: 'Entire req.body passed to DB create/update — mass assignment',
    cwe: 'CWE-915', owasp: 'A03:2021',
    poc: 'POST {"email":"x","role":"admin","isAdmin":true} — elevates privileges',
    fix: 'Destructure only allowed fields: const { email, name } = req.body; new User({ email, name });',
  },
  {
    id: 'MASS-ASSIGN-002', category: 'Mass Assignment', severity: 'HIGH',
    pattern: /Object\.assign\s*\(\s*\w+\s*,\s*req\.body\s*\)/g,
    description: 'Object.assign with req.body — uncontrolled field injection',
    cwe: 'CWE-915', owasp: 'A03:2021',
    poc: 'Inject arbitrary fields including admin flags',
    fix: 'Use explicit field allowlist instead of Object.assign with req.body',
  },

  // ── GraphQL Security ──────────────────────────────────────────────────────
  {
    id: 'GQL-001', category: 'GraphQL Misconfiguration', severity: 'HIGH',
    pattern: /introspection\s*:\s*true/gi,
    description: 'GraphQL introspection enabled in production — schema exposed',
    cwe: 'CWE-200', owasp: 'A05:2021',
    poc: 'Query {__schema{types{name}}} to enumerate all types, queries, mutations',
    fix: 'Disable introspection in production: introspection: process.env.NODE_ENV !== "production"',
  },
  {
    id: 'GQL-002', category: 'GraphQL Misconfiguration', severity: 'HIGH',
    pattern: /depth(?:Limit)?\s*:\s*(?:undefined|null|Infinity|999|100)/gi,
    description: 'No GraphQL query depth limit — nested query DoS attack',
    cwe: 'CWE-400', owasp: 'A04:2021',
    poc: '{ user { friends { friends { friends { friends { id } } } } } } (exponential)',
    fix: 'Use graphql-depth-limit: validate: [depthLimit(5)]',
  },

  // ── HTTP Method Confusion ─────────────────────────────────────────────────
  {
    id: 'METHOD-001', category: 'HTTP Method Confusion', severity: 'MEDIUM',
    pattern: /app\.all\s*\(/g,
    description: 'app.all() accepts any HTTP method — may bypass method-specific auth',
    cwe: 'CWE-650', owasp: 'A01:2021',
    poc: 'Use HEAD, OPTIONS, or TRACE instead of GET to bypass method-specific middleware',
    fix: 'Use explicit method handlers: app.get(), app.post(), etc.',
  },

  // ── Error Leakage ─────────────────────────────────────────────────────────
  {
    id: 'ERR-LEAK-001', category: 'Information Leakage', severity: 'MEDIUM',
    pattern: /res\.(?:send|json)\s*\(\s*(?:err|error|e)(?:\.message|\.stack)?\s*\)/g,
    description: 'Raw error/stack trace sent to client — information disclosure',
    cwe: 'CWE-209', owasp: 'A05:2021',
    poc: 'Trigger an error; stack trace reveals file paths, library versions, DB schema',
    fix: 'res.status(500).json({ error: "Internal Server Error" }) — never expose err.stack in production',
  },
  {
    id: 'ERR-LEAK-002', category: 'Information Leakage', severity: 'LOW',
    pattern: /x-powered-by/gi,
    description: 'X-Powered-By header may reveal technology stack',
    cwe: 'CWE-200', owasp: 'A05:2021',
    poc: 'HTTP response header X-Powered-By: Express reveals framework',
    fix: 'app.disable("x-powered-by") or use helmet(): app.use(helmet())',
  },

  // ── Replay Attack ─────────────────────────────────────────────────────────
  {
    id: 'REPLAY-001', category: 'Replay Attack', severity: 'MEDIUM',
    pattern: /(?:timestamp|nonce|idempotency).*(?:req\.|body\.|query\.)(?![\s\S]{0,100}(?:verify|check|validate|compare))/gi,
    description: 'Timestamp/nonce present but may not be verified — replay attack possible',
    cwe: 'CWE-294', owasp: 'A07:2021',
    poc: 'Capture and replay a signed payment request to charge twice',
    fix: 'Verify nonce uniqueness in Redis with TTL; reject requests with stale timestamps (>5 min)',
  },

  // ── No Input Validation ───────────────────────────────────────────────────
  {
    id: 'VALID-001', category: 'Missing Input Validation', severity: 'MEDIUM',
    pattern: /(?:req\.body|req\.query|req\.params)(?![\s\S]{0,50}(?:validate|joi\.|Yup\.|zod\.|schema\.|sanitize|check\())/g,
    description: 'Request data used without apparent schema validation',
    cwe: 'CWE-20', owasp: 'A03:2021',
    poc: 'Inject malformed data that bypasses application logic',
    fix: 'Validate with Joi/Zod: const { error } = schema.validate(req.body); if (error) return 400;',
  },
];

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}
function getLineContent(content, lineNum) {
  return (content.split('\n')[lineNum - 1] || '').trim().slice(0, 140);
}

const apiSecurityScanTool = new DynamicStructuredTool({
  name: 'api_security_scan',
  description: 'Scan an API file for rate limiting absence, excessive data exposure, mass assignment, GraphQL issues, error leakage, and replay attacks.',
  schema: z.object({ filePath: z.string(), content: z.string() }),
  func: async ({ filePath, content }) => {
    const findings = [];
    for (const vuln of API_PATTERNS) {
      const regex = new RegExp(vuln.pattern.source, vuln.pattern.flags);
      let match;
      while ((match = regex.exec(content)) !== null) {
        const lineNum = getLineNumber(content, match.index);
        findings.push({
          ruleId: vuln.id, category: vuln.category, severity: vuln.severity,
          description: vuln.description, cwe: vuln.cwe, owasp: vuln.owasp,
          poc: vuln.poc || '', fix: vuln.fix || '',
          file: filePath, line: lineNum,
          snippet: getLineContent(content, lineNum),
          match: match[0].slice(0, 120),
          source: 'API Security',
        });
      }
    }
    return JSON.stringify({ file: filePath, findingsCount: findings.length, findings });
  },
});

// ─── Check for Helmet / Security Headers ────────────────────────────────────
const securityHeadersTool = new DynamicStructuredTool({
  name: 'security_headers_check',
  description: 'Check if security headers middleware (helmet, CORS config, CSP) is properly configured.',
  schema: z.object({ files: z.array(z.object({ filePath: z.string(), content: z.string() })) }),
  func: async ({ files }) => {
    const issues = [];
    const mainFiles = files.filter(f => /(?:index|app|server)\.[jt]s$/.test(f.filePath));

    for (const file of mainFiles) {
      const content = file.content;
      const checks = [
        { name: 'helmet', re: /require\s*\(\s*['"]helmet['"]\s*\)|import\s+helmet/g, msg: 'helmet not found — missing 12 security headers', sev: 'HIGH', fix: 'npm install helmet; app.use(helmet())' },
        { name: 'CORS wildcard', re: /cors\s*\(\s*\{[^}]*origin\s*:\s*['"]?\*['"]?/g, msg: 'CORS allows all origins (*) — CSRF risk', sev: 'HIGH', fix: 'Specify exact origins: cors({ origin: process.env.ALLOWED_ORIGIN })' },
        { name: 'HPP', re: /require\s*\(\s*['"]hpp['"]\s*\)/g, msg: 'HPP (HTTP Parameter Pollution) protection not found', sev: 'MEDIUM', fix: 'npm install hpp; app.use(hpp())' },
        { name: 'nosniff', re: /noSniff|x-content-type/gi, msg: 'X-Content-Type-Options header not set', sev: 'LOW', fix: 'app.use(helmet.noSniff())' },
      ];

      for (const check of checks) {
        if (check.name === 'helmet' && !check.re.test(content)) {
          issues.push({ file: file.filePath, severity: check.sev, category: 'Missing Security Headers', description: check.msg, fix: check.fix, source: 'API Security', cwe: 'CWE-693', owasp: 'A05:2021' });
        }
        if (check.name === 'CORS wildcard') {
          const re = new RegExp(check.re.source, check.re.flags);
          if (re.test(content)) {
            const lineMatch = content.match(re);
            issues.push({ file: file.filePath, severity: check.sev, category: 'Security Misconfiguration', description: check.msg, fix: check.fix, source: 'API Security', cwe: 'CWE-942', owasp: 'A05:2021' });
          }
        }
      }
    }
    return JSON.stringify({ issues });
  },
});

module.exports = { apiSecurityScanTool, securityHeadersTool, API_PATTERNS };
