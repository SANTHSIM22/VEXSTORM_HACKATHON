/**
 * SECRET SCAN TOOLS
 * Detects hardcoded credentials, API keys, tokens, and private keys
 * across all file types including .env, config files, and source code.
 */

const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');

// ─── Secret patterns with entropy checks ──────────────────────────────────────
const SECRET_RULES = [
  // AWS
  { id: 'AWS-KEY',    name: 'AWS Access Key ID',        regex: /AKIA[0-9A-Z]{16}/g,                   severity: 'CRITICAL' },
  { id: 'AWS-SECRET', name: 'AWS Secret Access Key',    regex: /(?:aws.secret|AWS_SECRET)[^\n]*[A-Za-z0-9/+=]{40}/gi, severity: 'CRITICAL' },

  // Google
  { id: 'GCP-KEY',    name: 'Google API Key',           regex: /AIza[0-9A-Za-z\-_]{35}/g,             severity: 'CRITICAL' },
  { id: 'GCP-OAUTH',  name: 'Google OAuth Token',       regex: /ya29\.[0-9A-Za-z\-_]+/g,              severity: 'CRITICAL' },

  // GitHub
  { id: 'GH-PAT',     name: 'GitHub Personal Token',   regex: /ghp_[a-zA-Z0-9]{36}/g,                severity: 'CRITICAL' },
  { id: 'GH-OAUTH',   name: 'GitHub OAuth Token',       regex: /gho_[a-zA-Z0-9]{36}/g,                severity: 'CRITICAL' },

  // Stripe
  { id: 'STRIPE-SK',  name: 'Stripe Secret Key',        regex: /sk_live_[a-zA-Z0-9]{24,}/g,           severity: 'CRITICAL' },
  { id: 'STRIPE-PK',  name: 'Stripe Publishable Key',   regex: /pk_live_[a-zA-Z0-9]{24,}/g,           severity: 'HIGH'     },

  // SendGrid / Twilio / Mailgun
  { id: 'SG-KEY',     name: 'SendGrid API Key',         regex: /SG\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g, severity: 'CRITICAL' },
  { id: 'TWILIO-SID', name: 'Twilio Account SID',       regex: /AC[a-f0-9]{32}/g,                     severity: 'HIGH'     },
  { id: 'TWILIO-TOK', name: 'Twilio Auth Token',        regex: /(?:twilio.auth.token)[^\n]*[a-f0-9]{32}/gi, severity: 'CRITICAL' },

  // JWT
  { id: 'JWT-WEAK',   name: 'Weak JWT Secret',          regex: /(?:jwt.secret|JWT_SECRET)\s*[=:]\s*['"](?!process\.env)[^'"]{1,30}['"]/gi, severity: 'HIGH' },
  { id: 'JWT-RAW',    name: 'Raw JWT Token',             regex: /eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/g, severity: 'MEDIUM' },

  // Passwords
  { id: 'PW-HARD',    name: 'Hardcoded Password',       regex: /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]{4,}['"]/gi, severity: 'CRITICAL' },
  { id: 'DB-URL',     name: 'DB Connection String',     regex: /(?:mongodb|postgresql|mysql|redis):\/\/[^:]+:[^@]+@[^\s'"]+/gi, severity: 'CRITICAL' },

  // Private Keys
  { id: 'RSA-KEY',    name: 'RSA Private Key',          regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, severity: 'CRITICAL' },
  { id: 'PEM-CERT',   name: 'PEM Certificate',          regex: /-----BEGIN CERTIFICATE-----/g,         severity: 'MEDIUM'   },

  // Generic high-entropy secrets
  { id: 'GEN-SECRET', name: 'Generic Secret',           regex: /(?:secret|token|auth.key)\s*[=:]\s*['"][a-zA-Z0-9+/=_\-]{20,}['"]/gi, severity: 'HIGH' },

  // .env file entries with values
  { id: 'ENV-SECRET', name: '.env Secret Entry',        regex: /^[A-Z_]*(SECRET|KEY|TOKEN|PASSWORD|PRIVATE)[A-Z_]*\s*=\s*.{4,}$/gm, severity: 'HIGH' },
];

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

// ─── Simple entropy calculation (Shannon) ─────────────────────────────────────
function shannonEntropy(str) {
  const freq = {};
  for (const char of str) freq[char] = (freq[char] || 0) + 1;
  const len = str.length;
  return -Object.values(freq).reduce((acc, count) => {
    const p = count / len;
    return acc + p * Math.log2(p);
  }, 0);
}

// ─── Tool 1: Scan a single file for secrets ───────────────────────────────────
const secretScanFileTool = new DynamicStructuredTool({
  name: 'secret_scan_file',
  description:
    'Scan a file for hardcoded secrets, API keys, tokens, and credentials. ' +
    'Returns all matches with their locations and severity.',
  schema: z.object({
    filePath: z.string().describe('Absolute path of the file'),
    content: z.string().describe('Full text content of the file'),
  }),
  func: async ({ filePath, content }) => {
    const secrets = [];

    for (const rule of SECRET_RULES) {
      const regex = new RegExp(rule.regex.source, rule.regex.flags);
      let match;
      while ((match = regex.exec(content)) !== null) {
        const lineNum = getLineNumber(content, match.index);
        const value = match[0];

        // Skip low-entropy matches for generic rules
        if (rule.id === 'GEN-SECRET') {
          const extractedVal = value.split(/['":=\s]+/).pop() || '';
          if (shannonEntropy(extractedVal) < 3.5) continue;
        }

        secrets.push({
          ruleId: rule.id,
          name: rule.name,
          severity: rule.severity,
          file: filePath,
          line: lineNum,
          // Redact middle of the actual secret value
          match: value.length > 20
            ? value.slice(0, 6) + '***REDACTED***' + value.slice(-4)
            : value,
          cwe: 'CWE-798',
          owasp: 'A02:2021',
          recommendation: `Remove hardcoded ${rule.name}. Use environment variables and a secrets manager (e.g. Vault, AWS Secrets Manager).`,
        });
      }
    }

    return JSON.stringify({ file: filePath, secretsFound: secrets.length, secrets });
  },
});

// ─── Tool 2: Scan entire project for secrets ──────────────────────────────────
const secretScanProjectTool = new DynamicStructuredTool({
  name: 'secret_scan_project',
  description:
    'Scan all provided files for hardcoded secrets and credentials. ' +
    'Returns a consolidated report grouped by severity.',
  schema: z.object({
    files: z.array(
      z.object({ filePath: z.string(), content: z.string() })
    ).describe('Array of {filePath, content} objects'),
  }),
  func: async ({ files }) => {
    const allSecrets = [];

    for (const f of files) {
      const result = JSON.parse(
        await secretScanFileTool.invoke({ filePath: f.filePath, content: f.content })
      );
      allSecrets.push(...result.secrets);
    }

    const bySeverity = {};
    for (const s of allSecrets) {
      if (!bySeverity[s.severity]) bySeverity[s.severity] = [];
      bySeverity[s.severity].push(s);
    }

    return JSON.stringify({
      totalSecrets: allSecrets.length,
      bySeverity: Object.fromEntries(
        Object.entries(bySeverity).map(([k, v]) => [k, v.length])
      ),
      secrets: allSecrets,
    });
  },
});

module.exports = { secretScanFileTool, secretScanProjectTool };
