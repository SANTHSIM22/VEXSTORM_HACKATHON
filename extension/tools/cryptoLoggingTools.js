/**
 * CRYPTO & LOGGING ANALYSIS TOOLS
 * Checks for weak cryptography, insecure random number generation,
 * sensitive data in logs, missing audit trails, and tamper-evident logging.
 */

'use strict';

const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');

const CRYPTO_PATTERNS = [
  // ── Weak Hashing Algorithms ───────────────────────────────────────────────
  {
    id: 'CRYPT-001', category: 'Weak Cryptography', severity: 'HIGH',
    pattern: /createHash\s*\(\s*['"]md5['"]\s*\)/gi,
    description: 'MD5 hash algorithm — cryptographically broken, collision attacks exist',
    cwe: 'CWE-327', owasp: 'A02:2021',
    poc: 'MD5 collision attack: two different inputs produce same hash (Flame malware technique)',
    fix: 'Replace with SHA-256 or SHA-3: crypto.createHash("sha256")',
  },
  {
    id: 'CRYPT-002', category: 'Weak Cryptography', severity: 'HIGH',
    pattern: /createHash\s*\(\s*['"]sha1['"]\s*\)/gi,
    description: 'SHA-1 hash algorithm — broken since 2017 (SHAttered attack)',
    cwe: 'CWE-327', owasp: 'A02:2021',
    poc: 'SHA-1 collision generated in 2017 with 6500 GPU-years of computation',
    fix: 'Use crypto.createHash("sha256") or "sha512"',
  },
  {
    id: 'CRYPT-003', category: 'Weak Cryptography', severity: 'HIGH',
    pattern: /createCipheriv?\s*\(\s*['"](?:des|rc4|aes-128-ecb|aes-256-ecb)['"]/gi,
    description: 'Weak or broken cipher (DES/RC4/ECB mode) — not cryptographically secure',
    cwe: 'CWE-327', owasp: 'A02:2021',
    poc: 'ECB mode reveals patterns; DES is brute-forceable; RC4 has statistical biases',
    fix: 'Use AES-256-GCM: crypto.createCipheriv("aes-256-gcm", key, iv)',
  },
  {
    id: 'CRYPT-004', category: 'Weak Cryptography', severity: 'MEDIUM',
    pattern: /createCipheriv?\s*\(\s*['"]aes-(?:128|192|256)-cbc['"]/gi,
    description: 'AES-CBC mode without authentication — padding oracle and bit-flip attacks',
    cwe: 'CWE-327', owasp: 'A02:2021',
    poc: 'CBC mode is vulnerable to BEAST and padding oracle attacks without HMAC',
    fix: 'Use AES-256-GCM (authenticated encryption): crypto.createCipheriv("aes-256-gcm", key, iv)',
  },
  {
    id: 'CRYPT-005', category: 'Weak Cryptography', severity: 'CRITICAL',
    pattern: /iv\s*[=:]\s*(?:['"]0{16,}['"]|Buffer\.alloc\s*\(\s*\d+\s*\)(?!\s*\.\s*fill|\s*=\s*crypto))/gi,
    description: 'Hardcoded or zero IV in cipher — deterministic encryption defeats purpose',
    cwe: 'CWE-329', owasp: 'A02:2021',
    poc: 'Same plaintext always produces same ciphertext — crib-dragging attack',
    fix: 'Always use random IV: const iv = crypto.randomBytes(16)',
  },
  {
    id: 'CRYPT-006', category: 'Weak Cryptography', severity: 'HIGH',
    pattern: /Math\.random\s*\(\s*\)(?![\s\S]{0,50}(?:floor|crypt|color|style|display))/g,
    description: 'Math.random() used for security-sensitive values — not cryptographically random',
    cwe: 'CWE-338', owasp: 'A02:2021',
    poc: 'Math.random() is seeded and predictable — tokens can be predicted',
    fix: 'Use crypto.randomBytes(32).toString("hex") for security-sensitive randomness',
  },
  {
    id: 'CRYPT-007', category: 'Weak Cryptography', severity: 'HIGH',
    pattern: /bcrypt\.hash\s*\([^,]+,\s*([1-9])\s*\)/g,
    description: 'bcrypt with low cost factor — weak against offline brute-force attacks',
    cwe: 'CWE-916', owasp: 'A02:2021',
    poc: 'Low cost factor (e.g. 4) allows millions of hash checks per second on GPU',
    fix: 'Use cost factor >= 12: bcrypt.hash(password, 12)',
  },

  // ── Hardcoded Keys ────────────────────────────────────────────────────────
  {
    id: 'CRYPT-008', category: 'Hardcoded Cryptographic Key', severity: 'CRITICAL',
    pattern: /(?:secretKey|encryptionKey|privateKey|signingKey)\s*[=:]\s*['"][a-zA-Z0-9+/=_\-]{16,}['"]/gi,
    description: 'Hardcoded encryption/signing key in source — anyone with code access can decrypt data',
    cwe: 'CWE-321', owasp: 'A02:2021',
    poc: 'Use the hardcoded key to decrypt all encrypted user data from DB',
    fix: 'Load keys from HSM or secrets manager: process.env.ENCRYPTION_KEY',
  },

  // ── Custom Crypto ─────────────────────────────────────────────────────────
  {
    id: 'CRYPT-009', category: 'Custom Cryptography', severity: 'HIGH',
    pattern: /function\s+(?:encrypt|decrypt|cipher|hash|encode)\s*\([^)]*\)\s*\{[\s\S]{0,500}(?:charCodeAt|XOR|xor|\^=)/g,
    description: 'Custom encryption implementation detected — likely insecure (roll-your-own crypto)',
    cwe: 'CWE-327', owasp: 'A02:2021',
    poc: 'Custom crypto almost always has mathematical weaknesses exploitable by cryptanalysis',
    fix: 'Use battle-tested libraries only: Node.js crypto module, libsodium (sodium-native)',
  },

  // ── Password Hashing with non-bcrypt ─────────────────────────────────────
  {
    id: 'CRYPT-010', category: 'Weak Password Hashing', severity: 'HIGH',
    pattern: /createHash\s*\([^)]*\)\s*\.update\s*\([^)]*password/gi,
    description: 'Password hashed with generic hash function — not designed for passwords',
    cwe: 'CWE-916', owasp: 'A02:2021',
    poc: 'Generic hashes can be cracked with rainbow tables or GPU acceleration',
    fix: 'Use bcrypt, argon2, or scrypt for passwords: bcrypt.hash(password, 12)',
  },
];

// ─── Logging / Audit issues ───────────────────────────────────────────────────
const LOGGING_PATTERNS = [
  {
    id: 'LOG-001', category: 'Sensitive Data in Logs', severity: 'HIGH',
    pattern: /console\.log\s*\([^)]*(?:password|token|secret|key|auth|credential)/gi,
    description: 'Password/token/secret logged to console — exposed in application logs',
    cwe: 'CWE-532', owasp: 'A09:2021',
    poc: 'Log aggregation platform picks up credentials; accessible to all log viewers',
    fix: 'Never log sensitive data. Use structured logging with field-level redaction.',
  },
  {
    id: 'LOG-002', category: 'Sensitive Data in Logs', severity: 'HIGH',
    pattern: /logger\.(?:info|debug|warn|error)\s*\([^)]*(?:password|token|secret|key)/gi,
    description: 'Credentials passed to structured logger',
    cwe: 'CWE-532', owasp: 'A09:2021',
    poc: 'Logs shipped to Datadog/Splunk expose credentials to all log observers',
    fix: 'Mask sensitive fields before logging: logger.info({ userId: user.id }) // not user object',
  },
  {
    id: 'LOG-003', category: 'Missing Audit Logs', severity: 'MEDIUM',
    pattern: /(?:DELETE|DROP|TRUNCATE)\s+(?:FROM\s+)?['"`]?\w+['"`]?(?:[\s\S]{0,100}(?!.*(?:audit|log|track|record)))/gi,
    description: 'Destructive DB operation without apparent audit logging',
    cwe: 'CWE-778', owasp: 'A09:2021',
    poc: 'Data deleted without trace — no forensics possible after breach',
    fix: 'Log all destructive operations: logger.warn({ action: "DELETE", table, userId, timestamp })',
  },
  {
    id: 'LOG-004', category: 'Missing Audit Logs', severity: 'MEDIUM',
    pattern: /(?:login|logout|register|changePassword|updateRole|deleteUser)(?![\s\S]{0,200}(?:log\.|logger\.|audit|console\.))/gi,
    description: 'Auth action defined without apparent audit event logging',
    cwe: 'CWE-778', owasp: 'A09:2021',
    poc: 'Account takeover or admin actions leave no trail for incident response',
    fix: 'Log all auth events with user ID, IP, timestamp, success/failure',
  },
  {
    id: 'LOG-005', category: 'Stack Trace Exposure', severity: 'HIGH',
    pattern: /(?:res|response)\.(?:send|json)\s*\([^)]*\.stack\b/g,
    description: 'Stack trace sent in HTTP response — reveals internal file paths and structure',
    cwe: 'CWE-209', owasp: 'A05:2021',
    poc: 'Error response shows full file path: /home/ubuntu/app/src/routes/users.js:47',
    fix: 'res.status(500).json({ error: "Internal Server Error" }) — log stack server-side only',
  },
  {
    id: 'LOG-006', category: 'Debug Mode in Production', severity: 'HIGH',
    pattern: /(?:debug\s*:\s*true|NODE_ENV\s*=\s*development|process\.env\.DEBUG\s*=\s*['"]?\*)/gi,
    description: 'Debug mode enabled — verbose error messages and internal details exposed',
    cwe: 'CWE-215', owasp: 'A05:2021',
    poc: 'Debug responses reveal DB queries, environment variables, stack traces',
    fix: 'Ensure NODE_ENV=production in all prod environments. Never set DEBUG=* in prod.',
  },
];

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}
function getLineContent(content, lineNum) {
  return (content.split('\n')[lineNum - 1] || '').trim().slice(0, 140);
}

// ─── Crypto scan tool ─────────────────────────────────────────────────────────
const cryptoScanTool = new DynamicStructuredTool({
  name: 'crypto_scan',
  description: 'Detect weak cryptography: MD5/SHA-1 hashing, ECB mode, hardcoded IVs, insecure random, custom crypto, weak bcrypt cost factors.',
  schema: z.object({ filePath: z.string(), content: z.string() }),
  func: async ({ filePath, content }) => {
    const findings = [];
    for (const vuln of CRYPTO_PATTERNS) {
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
          source: 'Cryptography',
        });
      }
    }
    return JSON.stringify({ file: filePath, findingsCount: findings.length, findings });
  },
});

// ─── Logging scan tool ────────────────────────────────────────────────────────
const loggingScanTool = new DynamicStructuredTool({
  name: 'logging_scan',
  description: 'Detect logging security issues: sensitive data in logs, missing audit logs, stack traces in responses, debug mode in production.',
  schema: z.object({ filePath: z.string(), content: z.string() }),
  func: async ({ filePath, content }) => {
    const findings = [];
    for (const vuln of LOGGING_PATTERNS) {
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
          source: 'Logging & Monitoring',
        });
      }
    }
    return JSON.stringify({ file: filePath, findingsCount: findings.length, findings });
  },
});

module.exports = { cryptoScanTool, loggingScanTool, CRYPTO_PATTERNS, LOGGING_PATTERNS };
