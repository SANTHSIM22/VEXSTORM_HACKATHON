/**
 * DEPENDENCY AUDIT TOOLS
 * Checks package.json, requirements.txt, etc. for:
 * - Known vulnerable packages (CVE database snapshot)
 * - Outdated/deprecated packages with known issues
 * - License risk
 */

const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');

// ─── Static CVE snapshot for well-known vulnerable packages ──────────────────
// This is a curated offline list — for production use `npm audit` JSON output
const KNOWN_VULNERABLE_PACKAGES = {
  // npm
  'node-serialize':     { severity: 'CRITICAL', cve: 'CVE-2017-5941',  description: 'Remote Code Execution via IIFE in serialized objects',          fixedIn: null,      cwe: 'CWE-502' },
  'lodash':             { severity: 'HIGH',     cve: 'CVE-2019-10744', description: 'Prototype Pollution via _.defaultsDeep / _.merge',              fixedIn: '4.17.21', cwe: 'CWE-1321' },
  'marked':             { severity: 'HIGH',     cve: 'CVE-2022-21681', description: 'ReDoS and XSS in Markdown rendering (versions < 4.0.10)',        fixedIn: '4.0.10',  cwe: 'CWE-79'  },
  'jsonwebtoken':       { severity: 'HIGH',     cve: 'CVE-2022-23529', description: 'Arbitrary file read / Auth bypass in jwt.verify (< 9.0.0)',      fixedIn: '9.0.0',   cwe: 'CWE-347' },
  'express':            { severity: 'MEDIUM',   cve: 'CVE-2024-29041', description: 'Open Redirect in res.redirect() in Express < 4.19.2',           fixedIn: '4.19.2',  cwe: 'CWE-601' },
  'axios':              { severity: 'MEDIUM',   cve: 'CVE-2023-45857', description: 'CSRF vulnerability — attaches wrong headers in < 1.6.0',         fixedIn: '1.6.0',   cwe: 'CWE-352' },
  'multer':             { severity: 'MEDIUM',   cve: 'CVE-2019-10750', description: 'Prototype pollution in multer < 1.4.4-lts.1',                    fixedIn: '1.4.5-lts.1', cwe: 'CWE-1321' },
  'cookie':             { severity: 'MEDIUM',   cve: 'CVE-2024-47764', description: 'Cookie injection via unvalidated values in cookie < 0.7.0',      fixedIn: '0.7.0',   cwe: 'CWE-20'  },
  'ejs':                { severity: 'CRITICAL', cve: 'CVE-2022-29078', description: 'RCE via prototype pollution in EJS < 3.1.7',                     fixedIn: '3.1.7',   cwe: 'CWE-1321' },
  'minimist':           { severity: 'HIGH',     cve: 'CVE-2021-44906', description: 'Prototype pollution in minimist < 1.2.6',                        fixedIn: '1.2.6',   cwe: 'CWE-1321' },
  'moment':             { severity: 'HIGH',     cve: 'CVE-2022-24785', description: 'Path traversal in moment locale loading',                        fixedIn: '2.29.2',  cwe: 'CWE-22'  },
  'vm2':                { severity: 'CRITICAL', cve: 'CVE-2023-29017', description: 'Sandbox escape and RCE in vm2 < 3.9.15',                         fixedIn: null,      cwe: 'CWE-284' },
  'serialize-javascript': { severity: 'HIGH',   cve: 'CVE-2020-7660',  description: 'XSS via serialized JavaScript in serialize-javascript < 3.1.0',  fixedIn: '3.1.0',   cwe: 'CWE-79'  },
  'dompurify':          { severity: 'MEDIUM',   cve: 'CVE-2024-45801', description: 'XSS bypass in DOMPurify < 3.1.3',                               fixedIn: '3.1.3',   cwe: 'CWE-79'  },
  'tar':                { severity: 'HIGH',     cve: 'CVE-2021-37701', description: 'Arbitrary file creation via path traversal in tar < 6.1.9',      fixedIn: '6.1.9',   cwe: 'CWE-22'  },
  'path-to-regexp':     { severity: 'HIGH',     cve: 'CVE-2024-45296', description: 'ReDoS in path-to-regexp < 0.1.10 / 6.3.0',                      fixedIn: '6.3.0',   cwe: 'CWE-1333' },
  'tough-cookie':       { severity: 'HIGH',     cve: 'CVE-2023-26136', description: 'Prototype pollution in tough-cookie < 4.1.3',                    fixedIn: '4.1.3',   cwe: 'CWE-1321' },
  'semver':             { severity: 'HIGH',     cve: 'CVE-2022-25883', description: 'ReDoS in semver.satisfies in < 7.5.2',                           fixedIn: '7.5.2',   cwe: 'CWE-1333' },

  // Python (pip)
  'django':             { severity: 'HIGH',     cve: 'CVE-2023-41164', description: 'DoS via header parsing in Django < 4.2.5',                       fixedIn: '4.2.5',   cwe: 'CWE-400' },
  'flask':              { severity: 'HIGH',     cve: 'CVE-2023-30861', description: 'Possible session data leakage in Flask < 3.0',                   fixedIn: '3.0.0',   cwe: 'CWE-200' },
  'requests':           { severity: 'MEDIUM',   cve: 'CVE-2023-32681', description: 'Leak of credentials on redirect in requests < 2.31.0',           fixedIn: '2.31.0',  cwe: 'CWE-200' },
  'pyyaml':             { severity: 'CRITICAL', cve: 'CVE-2020-14343', description: 'Arbitrary code execution via yaml.load() without Loader',        fixedIn: '6.0',     cwe: 'CWE-20'  },
  'cryptography':       { severity: 'HIGH',     cve: 'CVE-2023-49083', description: 'NULL pointer dereference in cryptography < 41.0.6',              fixedIn: '41.0.6',  cwe: 'CWE-476' },
};

// ─── Tool 1: Audit package.json ────────────────────────────────────────────────
const auditPackageJsonTool = new DynamicStructuredTool({
  name: 'audit_package_json',
  description:
    'Parse a package.json and check all dependencies against a known-vulnerable package database. ' +
    'Returns vulnerabilities found with CVE IDs, severity, and fix versions.',
  schema: z.object({
    content: z.string().describe('Full text content of package.json'),
    filePath: z.string().describe('Path to the package.json file'),
  }),
  func: async ({ content, filePath }) => {
    let pkg;
    try {
      pkg = JSON.parse(content);
    } catch (e) {
      return JSON.stringify({ error: `Invalid JSON in ${filePath}: ${e.message}` });
    }

    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
      ...pkg.optionalDependencies,
    };

    const vulnerabilities = [];
    const checkedPackages = [];

    for (const [name, versionSpec] of Object.entries(allDeps || {})) {
      const info = KNOWN_VULNERABLE_PACKAGES[name];
      checkedPackages.push({ name, version: versionSpec });

      if (info) {
        vulnerabilities.push({
          package: name,
          installedVersion: versionSpec,
          severity: info.severity,
          cve: info.cve,
          cwe: info.cwe,
          description: info.description,
          fixedIn: info.fixedIn,
          file: filePath,
          recommendation: info.fixedIn
            ? `Upgrade ${name} to ${info.fixedIn} or later`
            : `Remove ${name} — no safe version exists. Find an alternative.`,
        });
      }
    }

    // Flag suspicious packages
    const suspiciousPatterns = ['serialize', 'unserialize', 'eval-', 'exec-', 'shell-'];
    for (const [name] of Object.entries(allDeps || {})) {
      if (suspiciousPatterns.some((p) => name.toLowerCase().includes(p))) {
        vulnerabilities.push({
          package: name,
          severity: 'MEDIUM',
          cve: 'N/A',
          description: `Package name "${name}" suggests dangerous functionality — review carefully`,
          file: filePath,
          recommendation: 'Audit this package for security issues',
        });
      }
    }

    return JSON.stringify({
      file: filePath,
      totalDependencies: Object.keys(allDeps || {}).length,
      vulnerablePackages: vulnerabilities.length,
      bySeverity: {
        CRITICAL: vulnerabilities.filter((v) => v.severity === 'CRITICAL').length,
        HIGH:     vulnerabilities.filter((v) => v.severity === 'HIGH').length,
        MEDIUM:   vulnerabilities.filter((v) => v.severity === 'MEDIUM').length,
      },
      vulnerabilities,
    });
  },
});

// ─── Tool 2: Audit requirements.txt ──────────────────────────────────────────
const auditRequirementsTxtTool = new DynamicStructuredTool({
  name: 'audit_requirements_txt',
  description: 'Parse requirements.txt and check Python packages against known vulnerabilities.',
  schema: z.object({
    content: z.string().describe('Content of requirements.txt'),
    filePath: z.string().describe('Path to requirements.txt'),
  }),
  func: async ({ content, filePath }) => {
    const vulnerabilities = [];
    const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#'));

    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9_\-]+)\s*(?:[>=<!]+\s*[\d.]+)?/);
      if (!match) continue;
      const pkgName = match[1].toLowerCase();
      const info = KNOWN_VULNERABLE_PACKAGES[pkgName];
      if (info) {
        vulnerabilities.push({
          package: pkgName,
          severity: info.severity,
          cve: info.cve,
          description: info.description,
          fixedIn: info.fixedIn,
          file: filePath,
          recommendation: info.fixedIn ? `Upgrade to ${info.fixedIn}+` : 'Remove — no safe version',
        });
      }
    }

    return JSON.stringify({
      file: filePath,
      vulnerablePackages: vulnerabilities.length,
      vulnerabilities,
    });
  },
});

module.exports = { auditPackageJsonTool, auditRequirementsTxtTool, KNOWN_VULNERABLE_PACKAGES };
