'use strict';

/**
 * INFRA SCANNER — standalone plain-JS (no LangChain)
 * Extracted from extension/tools/infraScanTools.js
 */

const path = require('path');

const DOCKERFILE_PATTERNS = [
  { id: 'DOCK-001', category: 'Container Security', severity: 'HIGH', pattern: /^USER\s+root\s*$/gm, description: 'Container running as root — privilege escalation if compromised', cwe: 'CWE-269', owasp: 'A05:2021', poc: 'Container escape → immediate root on host in misconfigured setups', fix: 'Add non-root user: RUN addgroup -S app && adduser -S app -G app; USER app' },
  { id: 'DOCK-002', category: 'Container Security', severity: 'MEDIUM', pattern: /^FROM\s+\w+:latest\s*$/gm, description: 'Docker image uses :latest tag — non-deterministic builds, unknown vulnerabilities', cwe: 'CWE-1104', owasp: 'A06:2021', poc: 'Latest image may pull a version with critical CVEs on next build', fix: 'Pin to specific versions: FROM node:20.11.0-alpine3.19' },
  { id: 'DOCK-003', category: 'Container Security', severity: 'HIGH', pattern: /^(ENV|ARG)\s+(?:DB_PASSWORD|SECRET|API_KEY|JWT_SECRET|PRIVATE_KEY)\s*=/gim, description: 'Secrets set as ENV or ARG in Dockerfile — baked into image layers', cwe: 'CWE-798', owasp: 'A02:2021', poc: 'docker history <image> --no-trunc reveals all ENV variables including secrets', fix: 'Use Docker secrets or runtime env injection. Never bake secrets into layers.' },
  { id: 'DOCK-004', category: 'Container Security', severity: 'MEDIUM', pattern: /^EXPOSE\s+(?:22|23|3389|5900|5432|3306|27017|6379|9200|8080)\s*$/gm, description: 'Sensitive port exposed in Dockerfile — unnecessary attack surface', cwe: 'CWE-284', owasp: 'A05:2021', poc: 'Exposed DB port allows direct connection bypassing application layer', fix: 'Remove unnecessary EXPOSE statements. Use internal Docker networks.' },
  { id: 'DOCK-005', category: 'Container Security', severity: 'MEDIUM', pattern: /^ADD\s+https?:\/\//gm, description: 'ADD from URL without checksum — supply chain attack risk', cwe: 'CWE-494', owasp: 'A06:2021', poc: 'Attacker compromises remote URL to inject malicious binary', fix: 'Use COPY for local files. For URLs: use RUN curl + sha256sum verification' },
];

const COMPOSE_PATTERNS = [
  { id: 'COMP-001', category: 'Container Security', severity: 'HIGH', pattern: /privileged\s*:\s*true/gi, description: 'Container running in privileged mode — full host access', cwe: 'CWE-269', owasp: 'A05:2021', poc: 'Mount host filesystem from within container', fix: 'Remove privileged: true. Drop capabilities individually if needed.' },
  { id: 'COMP-002', category: 'Container Security', severity: 'HIGH', pattern: /\s+ports:\s*\n(?:\s+[-]\s*["']?0\.0\.0\.0:[0-9]+:[0-9]+)/gm, description: 'Service port bound to 0.0.0.0 — accessible from all network interfaces', cwe: 'CWE-284', owasp: 'A05:2021', poc: 'DB/Redis directly accessible from internet if host has public IP', fix: 'Bind to 127.0.0.1 only or use internal Docker network' },
  { id: 'COMP-003', category: 'Sensitive Data Exposure', severity: 'CRITICAL', pattern: /^\s+(?:PASS(?:WORD)?|SECRET|API_KEY|JWT_SECRET|DB_PASSWORD)\s*[=:]\s*\S/gim, description: 'Hardcoded secret in docker-compose.yml — committed to version control', cwe: 'CWE-798', owasp: 'A02:2021', poc: 'git log reveals all compose files with secrets in history', fix: 'Use Docker secrets or .env file (add to .gitignore): env_file: [.env]' },
];

const ENV_FILE_PATTERNS = [
  { id: 'ENV-001', category: 'Sensitive Data Exposure', severity: 'CRITICAL', pattern: /^(?:DATABASE_URL|MONGODB_URI|REDIS_URL)\s*=\s*\S+@\S+/gm, description: 'DB connection string with credentials in .env file', cwe: 'CWE-798', owasp: 'A02:2021', fix: 'Ensure .env is in .gitignore and never committed' },
  { id: 'ENV-002', category: 'Sensitive Data Exposure', severity: 'HIGH', pattern: /^(?:JWT_SECRET|SESSION_SECRET|COOKIE_SECRET)\s*=\s*['"]?(?:secret|changeme|default|keyboard cat|test|dev)['"]{0,1}\s*$/gim, description: 'JWT/session secret set to well-known default value', cwe: 'CWE-798', owasp: 'A07:2021', poc: 'Forge any JWT/session token using the known default secret', fix: 'Generate strong random secret: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"' },
  { id: 'ENV-003', category: 'Sensitive Data Exposure', severity: 'HIGH', pattern: /^NODE_ENV\s*=\s*(?:development|dev|test)\s*$/gim, description: 'NODE_ENV is not "production" — debug features and error stacks may be enabled', cwe: 'CWE-215', owasp: 'A05:2021', fix: 'Set NODE_ENV=production in production deployments' },
];

const CICD_PATTERNS = [
  { id: 'CI-001', category: 'CI/CD Security', severity: 'HIGH', pattern: /\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}.*permissions\s*:\s*write-all/gi, description: 'GitHub Actions using GITHUB_TOKEN with write-all permissions', cwe: 'CWE-732', owasp: 'A05:2021', fix: 'Use minimal permissions: permissions: { contents: read }' },
  { id: 'CI-002', category: 'CI/CD Security', severity: 'HIGH', pattern: /uses:\s*\w+\/\w+@(?!v\d|sha-)\S+/g, description: 'GitHub Action using floating ref (not pinned to SHA) — supply chain risk', cwe: 'CWE-494', owasp: 'A06:2021', poc: 'Action maintainer pushes malicious code to branch — executes in all pipelines', fix: 'Pin actions to full commit SHA' },
  { id: 'CI-003', category: 'Secrets Exposure', severity: 'CRITICAL', pattern: /echo\s+\$\{\{\s*secrets\./gi, description: 'Printing GitHub secret in CI step — secret leaked in logs', cwe: 'CWE-532', owasp: 'A02:2021', poc: 'Build logs visible to all repo contributors', fix: 'Never echo secrets.' },
];

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}
function getLineContent(content, lineNum) {
  return (content.split('\n')[lineNum - 1] || '').trim().slice(0, 140);
}

function scanWithPatterns(filePath, content, patterns, source) {
  const findings = [];
  for (const vuln of patterns) {
    const regex = new RegExp(vuln.pattern.source, vuln.pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lineNum = getLineNumber(content, match.index);
      findings.push({ ruleId: vuln.id, category: vuln.category, severity: vuln.severity, description: vuln.description, cwe: vuln.cwe || 'CWE-0', owasp: vuln.owasp || 'A05:2021', poc: vuln.poc || '', fix: vuln.fix || '', file: filePath, line: lineNum, snippet: getLineContent(content, lineNum), match: match[0].slice(0, 120), source });
    }
  }
  return findings;
}

function scanInfra(filePath, content) {
  const base = path.basename(filePath).toLowerCase();
  let findings = [];
  if (base === 'dockerfile') {
    findings = scanWithPatterns(filePath, content, DOCKERFILE_PATTERNS, 'Infrastructure');
  } else if (base === 'docker-compose.yml' || base === 'docker-compose.yaml') {
    findings = scanWithPatterns(filePath, content, COMPOSE_PATTERNS, 'Infrastructure');
  } else if (base.startsWith('.env')) {
    findings = scanWithPatterns(filePath, content, ENV_FILE_PATTERNS, 'Infrastructure');
  } else if (filePath.includes('.github/workflows') || base.endsWith('.yml') || base.endsWith('.yaml')) {
    findings = [
      ...scanWithPatterns(filePath, content, COMPOSE_PATTERNS, 'Infrastructure'),
      ...scanWithPatterns(filePath, content, CICD_PATTERNS, 'CI/CD Security'),
    ];
  } else {
    findings = [
      ...scanWithPatterns(filePath, content, DOCKERFILE_PATTERNS, 'Infrastructure'),
      ...scanWithPatterns(filePath, content, COMPOSE_PATTERNS, 'Infrastructure'),
      ...scanWithPatterns(filePath, content, ENV_FILE_PATTERNS, 'Infrastructure'),
      ...scanWithPatterns(filePath, content, CICD_PATTERNS, 'CI/CD Security'),
    ];
  }
  return { file: filePath, findingsCount: findings.length, findings };
}

function auditGitignore(files, targetPath) {
  const issues = [];
  const gitignore = files.find(f => path.basename(f.filePath) === '.gitignore');
  const envFiles  = files.filter(f => path.basename(f.filePath).startsWith('.env'));
  if (envFiles.length > 0 && !gitignore) {
    issues.push({ category: 'Secrets Management', severity: 'CRITICAL', description: '.env files present but no .gitignore found — secrets will be committed to git', file: targetPath, line: 0, cwe: 'CWE-312', owasp: 'A02:2021', source: 'Infrastructure', fix: 'Create .gitignore with: .env .env.* .env.local .env.production' });
  } else if (gitignore && !(/\.env/.test(gitignore.content))) {
    issues.push({ category: 'Secrets Management', severity: 'CRITICAL', description: '.env not in .gitignore — secrets will be committed', file: gitignore.filePath, line: 0, cwe: 'CWE-312', owasp: 'A02:2021', source: 'Infrastructure', fix: 'Add to .gitignore: .env\n.env.*\n.env.local' });
  }
  return { issues };
}

module.exports = { scanInfra, auditGitignore, DOCKERFILE_PATTERNS, COMPOSE_PATTERNS, ENV_FILE_PATTERNS, CICD_PATTERNS };
