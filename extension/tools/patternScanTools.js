/**
 * PATTERN SCAN TOOLS
 * Fast regex-based heuristic scanning — no LLM needed.
 * Runs before LLM analysis to gather structural evidence.
 */

const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');

// ─── OWASP-mapped vulnerability patterns ─────────────────────────────────────
const VULN_PATTERNS = [
  // ── SQL Injection ────────────────────────────────────────────────────────
  {
    id: 'SQLI-001', category: 'SQL Injection', severity: 'CRITICAL',
    pattern: /`[^`]*SELECT[^`]*\$\{[^}]+\}[^`]*`/gi,
    description: 'Template literal used in SQL query — potential SQL injection',
    cwe: 'CWE-89', owasp: 'A03:2021',
  },
  {
    id: 'SQLI-002', category: 'SQL Injection', severity: 'CRITICAL',
    pattern: /(?:WHERE|AND|OR)\s+\w+\s*=\s*['"]?\s*\+\s*(?:req\.|request\.|params\.|query\.)/gi,
    description: 'String concatenation in SQL WHERE clause',
    cwe: 'CWE-89', owasp: 'A03:2021',
  },
  {
    id: 'SQLI-003', category: 'SQL Injection', severity: 'CRITICAL',
    pattern: /db\.prepare\(`[^`]*\$\{/gi,
    description: 'Template literal in db.prepare() — SQL injection',
    cwe: 'CWE-89', owasp: 'A03:2021',
  },
  {
    id: 'SQLI-004', category: 'SQL Injection', severity: 'HIGH',
    pattern: /\.query\s*\(\s*['"`][^'"`)]*\+/gi,
    description: 'String concatenation passed to .query()',
    cwe: 'CWE-89', owasp: 'A03:2021',
  },

  // ── Cross-Site Scripting (XSS) ───────────────────────────────────────────
  {
    id: 'XSS-001', category: 'XSS', severity: 'HIGH',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{/g,
    description: 'React dangerouslySetInnerHTML usage — potential XSS',
    cwe: 'CWE-79', owasp: 'A03:2021',
  },
  {
    id: 'XSS-002', category: 'XSS', severity: 'HIGH',
    pattern: /\.innerHTML\s*=\s*(?!['"`])/g,
    description: 'Direct innerHTML assignment with dynamic value',
    cwe: 'CWE-79', owasp: 'A03:2021',
  },
  {
    id: 'XSS-003', category: 'XSS', severity: 'HIGH',
    pattern: /document\.write\s*\(/g,
    description: 'document.write() can introduce XSS',
    cwe: 'CWE-79', owasp: 'A03:2021',
  },
  {
    id: 'XSS-004', category: 'XSS', severity: 'MEDIUM',
    pattern: /res\.send\s*\([^)]*req\.(query|body|params)/g,
    description: 'User input reflected directly in HTTP response — reflected XSS',
    cwe: 'CWE-79', owasp: 'A03:2021',
  },

  // ── Command Injection ────────────────────────────────────────────────────
  {
    id: 'CMDI-001', category: 'Command Injection', severity: 'CRITICAL',
    pattern: /(?:exec|execSync|spawn|spawnSync)\s*\([^)]*(?:req\.|request\.|params\.|query\.|body\.)/g,
    description: 'User-controlled input passed to exec/spawn — command injection',
    cwe: 'CWE-78', owasp: 'A03:2021',
  },
  {
    id: 'CMDI-002', category: 'Command Injection', severity: 'CRITICAL',
    pattern: /exec\s*\(\s*`[^`]*\$\{/g,
    description: 'Template literal in exec() — command injection risk',
    cwe: 'CWE-78', owasp: 'A03:2021',
  },

  // ── Path Traversal ───────────────────────────────────────────────────────
  {
    id: 'PATH-001', category: 'Path Traversal', severity: 'HIGH',
    pattern: /(?:readFileSync|readFile|createReadStream)\s*\([^)]*(?:req\.|request\.|params\.|query\.|body\.)/g,
    description: 'User input used in file read — path traversal risk',
    cwe: 'CWE-22', owasp: 'A01:2021',
  },
  {
    id: 'PATH-002', category: 'Path Traversal', severity: 'HIGH',
    pattern: /path\.join\s*\([^)]*(?:req\.|request\.|query\.|body\.)/g,
    description: 'User input in path.join() without sanitization',
    cwe: 'CWE-22', owasp: 'A01:2021',
  },

  // ── Hardcoded Secrets ────────────────────────────────────────────────────
  {
    id: 'SECRET-001', category: 'Hardcoded Secret', severity: 'CRITICAL',
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]{4,}['"]/gi,
    description: 'Hardcoded password detected',
    cwe: 'CWE-798', owasp: 'A02:2021',
  },
  {
    id: 'SECRET-002', category: 'Hardcoded Secret', severity: 'CRITICAL',
    pattern: /(?:api_key|apikey|api-key|secret_key|secretkey)\s*[=:]\s*['"][^'"]{8,}['"]/gi,
    description: 'Hardcoded API key or secret detected',
    cwe: 'CWE-798', owasp: 'A02:2021',
  },
  {
    id: 'SECRET-003', category: 'Hardcoded Secret', severity: 'CRITICAL',
    pattern: /AKIA[0-9A-Z]{16}/g,
    description: 'AWS Access Key ID pattern detected',
    cwe: 'CWE-798', owasp: 'A02:2021',
  },
  {
    id: 'SECRET-004', category: 'Hardcoded Secret', severity: 'HIGH',
    pattern: /jwt\.sign\([^,]+,\s*['"][^'"]{1,20}['"]/g,
    description: 'JWT signed with short/hardcoded secret',
    cwe: 'CWE-798', owasp: 'A02:2021',
  },
  {
    id: 'SECRET-005', category: 'Hardcoded Secret', severity: 'HIGH',
    pattern: /sk_live_[a-zA-Z0-9]{20,}/g,
    description: 'Stripe live secret key detected',
    cwe: 'CWE-798', owasp: 'A02:2021',
  },
  {
    id: 'SECRET-006', category: 'Hardcoded Secret', severity: 'HIGH',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    description: 'GitHub Personal Access Token detected',
    cwe: 'CWE-798', owasp: 'A02:2021',
  },

  // ── Insecure Deserialization ─────────────────────────────────────────────
  {
    id: 'DESER-001', category: 'Insecure Deserialization', severity: 'CRITICAL',
    pattern: /serialize\.unserialize\s*\(/g,
    description: 'node-serialize.unserialize() — known RCE vector',
    cwe: 'CWE-502', owasp: 'A08:2021',
  },
  {
    id: 'DESER-002', category: 'Insecure Deserialization', severity: 'HIGH',
    pattern: /eval\s*\([^)]*(?:req\.|request\.|JSON\.parse|body|query)/g,
    description: 'eval() with user-controlled or parsed input',
    cwe: 'CWE-95', owasp: 'A03:2021',
  },
  {
    id: 'DESER-003', category: 'Insecure Deserialization', severity: 'HIGH',
    pattern: /new\s+Function\s*\([^)]*(?:req\.|body\.|query\.)/g,
    description: 'new Function() with user-controlled input — code injection',
    cwe: 'CWE-95', owasp: 'A03:2021',
  },

  // ── SSRF ─────────────────────────────────────────────────────────────────
  {
    id: 'SSRF-001', category: 'SSRF', severity: 'HIGH',
    pattern: /(?:axios|fetch|http\.get|https\.get|request)\s*\([^)]*(?:req\.|query\.|body\.)/g,
    description: 'HTTP request made with user-supplied URL — SSRF risk',
    cwe: 'CWE-918', owasp: 'A10:2021',
  },

  // ── Insecure JWT / Auth ──────────────────────────────────────────────────
  {
    id: 'JWT-001', category: 'Broken Authentication', severity: 'CRITICAL',
    pattern: /algorithms\s*:\s*\[[^\]]*['"]none['"]/gi,
    description: 'JWT verification allows "none" algorithm — signature bypass',
    cwe: 'CWE-347', owasp: 'A07:2021',
  },
  {
    id: 'JWT-002', category: 'Broken Authentication', severity: 'HIGH',
    pattern: /jwt\.decode\s*\(/g,
    description: 'jwt.decode() used instead of jwt.verify() — no signature check',
    cwe: 'CWE-347', owasp: 'A07:2021',
  },
  {
    id: 'JWT-003', category: 'Broken Authentication', severity: 'HIGH',
    pattern: /httpOnly\s*:\s*false/g,
    description: 'Cookie httpOnly flag set to false — XSS can steal cookie',
    cwe: 'CWE-1004', owasp: 'A07:2021',
  },
  {
    id: 'JWT-004', category: 'Broken Authentication', severity: 'HIGH',
    pattern: /secure\s*:\s*false/g,
    description: 'Cookie Secure flag is false — sent over HTTP',
    cwe: 'CWE-614', owasp: 'A07:2021',
  },

  // ── Prototype Pollution ──────────────────────────────────────────────────
  {
    id: 'PROTO-001', category: 'Prototype Pollution', severity: 'HIGH',
    pattern: /(?:_\.merge|Object\.assign)\s*\([^)]*(?:req\.|body\.|query\.)/g,
    description: 'Merging user input into object — prototype pollution risk',
    cwe: 'CWE-1321', owasp: 'A03:2021',
  },

  // ── Open Redirect ────────────────────────────────────────────────────────
  {
    id: 'REDIR-001', category: 'Open Redirect', severity: 'MEDIUM',
    pattern: /res\.redirect\s*\([^)]*(?:req\.|query\.|body\.)/g,
    description: 'Redirect to user-supplied URL — open redirect',
    cwe: 'CWE-601', owasp: 'A01:2021',
  },

  // ── Mass Assignment ──────────────────────────────────────────────────────
  {
    id: 'MASS-001', category: 'Mass Assignment', severity: 'HIGH',
    pattern: /(?:INSERT|UPDATE)\s+INTO[^;]+\?[^;]+req\.body(?!\s*\.\s*\w)/gi,
    description: 'Entire req.body spread into database query — mass assignment',
    cwe: 'CWE-915', owasp: 'A01:2021',
  },

  // ── Missing Security Headers ─────────────────────────────────────────────
  {
    id: 'HEADER-001', category: 'Security Misconfiguration', severity: 'MEDIUM',
    pattern: /X-Frame-Options['":\s]+ALLOWALL/gi,
    description: 'X-Frame-Options set to ALLOWALL — clickjacking enabled',
    cwe: 'CWE-1021', owasp: 'A05:2021',
  },
  {
    id: 'HEADER-002', category: 'Security Misconfiguration', severity: 'MEDIUM',
    pattern: /cors\s*\(\s*\{[^}]*origin\s*:\s*['"]?\*['"]?/g,
    description: 'CORS allows all origins (*)',
    cwe: 'CWE-942', owasp: 'A05:2021',
  },

  // ── Cryptographic Issues ─────────────────────────────────────────────────
  {
    id: 'CRYPTO-001', category: 'Weak Cryptography', severity: 'HIGH',
    pattern: /createHash\s*\(\s*['"]md5['"]\s*\)/gi,
    description: 'MD5 used for hashing — cryptographically broken',
    cwe: 'CWE-327', owasp: 'A02:2021',
  },
  {
    id: 'CRYPTO-002', category: 'Weak Cryptography', severity: 'HIGH',
    pattern: /createHash\s*\(\s*['"]sha1['"]\s*\)/gi,
    description: 'SHA-1 used for hashing — weak, collision-prone',
    cwe: 'CWE-327', owasp: 'A02:2021',
  },

  // ── Sensitive Data Exposure ──────────────────────────────────────────────
  {
    id: 'DATA-001', category: 'Sensitive Data Exposure', severity: 'HIGH',
    pattern: /console\.log\s*\([^)]*(?:password|token|secret|key|auth)/gi,
    description: 'Sensitive data logged to console',
    cwe: 'CWE-532', owasp: 'A02:2021',
  },
  {
    id: 'DATA-002', category: 'Sensitive Data Exposure', severity: 'MEDIUM',
    pattern: /localStorage\.setItem\s*\([^)]*(?:password|token|secret)/gi,
    description: 'Sensitive data stored in localStorage',
    cwe: 'CWE-312', owasp: 'A02:2021',
  },
];

// ─── Helper: find line number of a match ──────────────────────────────────────
function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

function getLineContent(content, lineNum) {
  return content.split('\n')[lineNum - 1]?.trim() ?? '';
}

// ─── Tool 1: Run all patterns against a single file ──────────────────────────
const patternScanFileTool = new DynamicStructuredTool({
  name: 'pattern_scan_file',
  description:
    'Run all OWASP-mapped regex patterns against a single source file. ' +
    'Returns a list of findings with line numbers, severity, CWE, and OWASP mapping.',
  schema: z.object({
    filePath: z.string().describe('Absolute path of the file to scan'),
    content: z.string().describe('Full text content of the file'),
  }),
  func: async ({ filePath, content }) => {
    const findings = [];

    for (const vuln of VULN_PATTERNS) {
      const regex = new RegExp(vuln.pattern.source, vuln.pattern.flags);
      let match;
      while ((match = regex.exec(content)) !== null) {
        const lineNum = getLineNumber(content, match.index);
        findings.push({
          ruleId: vuln.id,
          category: vuln.category,
          severity: vuln.severity,
          description: vuln.description,
          cwe: vuln.cwe,
          owasp: vuln.owasp,
          file: filePath,
          line: lineNum,
          snippet: getLineContent(content, lineNum),
          match: match[0].slice(0, 120),
        });
      }
    }

    return JSON.stringify({
      file: filePath,
      findingsCount: findings.length,
      findings,
    });
  },
});

// ─── Tool 2: Run patterns against a batch of files ────────────────────────────
const patternScanBatchTool = new DynamicStructuredTool({
  name: 'pattern_scan_batch',
  description:
    'Run regex pattern scan across multiple files at once. ' +
    'Accepts an array of {filePath, content} objects.',
  schema: z.object({
    files: z.array(
      z.object({
        filePath: z.string(),
        content: z.string(),
      })
    ).describe('Array of files to scan'),
  }),
  func: async ({ files }) => {
    const allFindings = [];
    for (const f of files) {
      const result = JSON.parse(
        await patternScanFileTool.invoke({ filePath: f.filePath, content: f.content })
      );
      allFindings.push(...result.findings);
    }
    const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const f of allFindings) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;

    return JSON.stringify({
      totalFindings: allFindings.length,
      bySeverity,
      findings: allFindings,
    });
  },
});

// ─── Tool 3: Summary stats of findings ────────────────────────────────────────
const summarizeFindingsTool = new DynamicStructuredTool({
  name: 'summarize_findings',
  description: 'Group and summarize a list of vulnerability findings by category and severity.',
  schema: z.object({
    findings: z.array(z.any()).describe('Array of finding objects from pattern_scan_* tools'),
  }),
  func: async ({ findings }) => {
    const byCategory = {};
    const bySeverity = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };

    for (const f of findings) {
      if (!byCategory[f.category]) byCategory[f.category] = [];
      byCategory[f.category].push(f);
      if (bySeverity[f.severity]) bySeverity[f.severity].push(f);
    }

    return JSON.stringify({
      totalFindings: findings.length,
      categories: Object.keys(byCategory).map((cat) => ({
        category: cat,
        count: byCategory[cat].length,
        severities: [...new Set(byCategory[cat].map((f) => f.severity))],
      })),
      bySeverity: Object.fromEntries(
        Object.entries(bySeverity).map(([sev, items]) => [sev, items.length])
      ),
    });
  },
});

module.exports = {
  patternScanFileTool,
  patternScanBatchTool,
  summarizeFindingsTool,
  VULN_PATTERNS,
};
