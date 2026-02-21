/**
 * AST SCAN TOOLS
 * Uses Acorn to parse JavaScript/TypeScript files and walk the AST,
 * detecting dangerous patterns that regex cannot (e.g., eval as variable,
 * dynamic require, dangerous function calls with user data).
 */

const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');

let acorn, walk;
try {
  acorn = require('acorn');
  walk  = require('acorn-walk');
} catch {
  // Graceful fallback if acorn not installed yet
}

const JS_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);

// ─── Dangerous call patterns to detect in AST ────────────────────────────────
const DANGEROUS_CALLS = new Set([
  'eval', 'Function', 'setTimeout', 'setInterval', // code execution
  'exec', 'execSync', 'spawn', 'spawnSync', 'execFile', // OS commands
  'readFileSync', 'readFile', 'writeFileSync', 'writeFile', // file I/O
  'unlink', 'unlinkSync', 'rmdir', 'rmdirSync', 'rm',      // file deletion
  'require',                                                  // dynamic require
]);

const SENSITIVE_MEMBER_ACCESS = new Set([
  'innerHTML', 'outerHTML', 'document.write', 'eval',
]);

// ─── Tool: AST scan a JS/TS file ─────────────────────────────────────────────
const astScanFileTool = new DynamicStructuredTool({
  name: 'ast_scan_file',
  description:
    'Parse a JavaScript/TypeScript file with Acorn AST and detect dangerous code patterns: ' +
    'eval(), exec(), dynamic require(), prototype mutation, etc.',
  schema: z.object({
    filePath: z.string().describe('Absolute path of the JS/TS file'),
    content:  z.string().describe('Full text content of the file'),
  }),
  func: async ({ filePath, content }) => {
    if (!acorn || !walk) {
      return JSON.stringify({ error: 'acorn not available — run npm install in extension folder', filePath });
    }

    const ext = filePath.split('.').pop()?.toLowerCase();
    if (!JS_EXTENSIONS.has(`.${ext}`)) {
      return JSON.stringify({ skipped: true, reason: 'Not a JS file', filePath });
    }

    const findings = [];
    const lines = content.split('\n');

    function getLine(node) {
      if (!node?.loc) return 0;
      return node.loc.start.line;
    }

    function getSnippet(lineNum) {
      return (lines[lineNum - 1] || '').trim().slice(0, 120);
    }

    function addFinding(severity, category, description, node, extra = {}) {
      const line = getLine(node);
      findings.push({
        severity,
        category,
        description,
        file: filePath,
        line,
        snippet: getSnippet(line),
        cwe: extra.cwe || 'CWE-20',
        owasp: extra.owasp || 'A03:2021',
        ...extra,
      });
    }

    let ast;
    try {
      ast = acorn.parse(content, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true,
        allowHashBang: true,
        allowAwaitOutsideFunction: true,
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
      });
    } catch {
      // Try commonjs
      try {
        ast = acorn.parse(content, {
          ecmaVersion: 'latest',
          sourceType: 'script',
          locations: true,
          allowHashBang: true,
          allowReturnOutsideFunction: true,
        });
      } catch (e2) {
        // For JSX files, strip JSX tags and try again (best-effort)
        try {
          const stripped = content
            .replace(/<[A-Z][^>]*\/>/g, 'null')
            .replace(/<[A-Z][^>]*>[\s\S]*?<\/[A-Z][^>]*>/g, 'null')
            .replace(/<[a-z][^>]*\/>/g, 'null')
            .replace(/<[a-z][^>]*>[\s\S]*?<\/[a-z][^>]*>/g, 'null')
            .replace(/jsx?: ['"][^'"]*['"]/g, '');
          ast = acorn.parse(stripped, {
            ecmaVersion: 'latest', sourceType: 'module', locations: true,
            allowHashBang: true, allowReturnOutsideFunction: true, allowImportExportEverywhere: true,
          });
        } catch {
          return JSON.stringify({
            filePath,
            parseError: e2.message,
            findings: [],
            note: 'AST parse failed — pattern scan still covers this file',
          });
        }
      }
    }

    walk.simple(ast, {
      // ── eval() calls ──────────────────────────────────────────────────────
      CallExpression(node) {
        const callee = node.callee;

        // Direct eval()
        if (callee.type === 'Identifier' && callee.name === 'eval') {
          addFinding('CRITICAL', 'Code Injection', 'eval() call detected — can execute arbitrary code', node, {
            cwe: 'CWE-95', owasp: 'A03:2021',
          });
        }

        // new Function(...)
        if (
          node.type === 'NewExpression' &&
          callee.type === 'Identifier' &&
          callee.name === 'Function'
        ) {
          addFinding('HIGH', 'Code Injection', 'new Function() — dynamic code construction', node, {
            cwe: 'CWE-95', owasp: 'A03:2021',
          });
        }

        // exec/spawn with template literal or binary expression (potential injection)
        if (
          callee.type === 'Identifier' &&
          ['exec', 'execSync', 'spawn', 'spawnSync'].includes(callee.name)
        ) {
          const firstArg = node.arguments[0];
          if (firstArg && (
            firstArg.type === 'TemplateLiteral' ||
            firstArg.type === 'BinaryExpression'
          )) {
            addFinding('CRITICAL', 'Command Injection',
              `${callee.name}() called with dynamic string — command injection risk`, node, {
              cwe: 'CWE-78', owasp: 'A03:2021',
            });
          }
        }

        // Dynamic require()
        if (callee.type === 'Identifier' && callee.name === 'require') {
          const firstArg = node.arguments[0];
          if (firstArg && firstArg.type !== 'Literal') {
            addFinding('HIGH', 'Dynamic Require',
              'require() called with non-literal argument — may load attacker-controlled modules', node, {
              cwe: 'CWE-427', owasp: 'A08:2021',
            });
          }
        }

        // setTimeout/setInterval with string
        if (
          callee.type === 'Identifier' &&
          ['setTimeout', 'setInterval'].includes(callee.name)
        ) {
          const firstArg = node.arguments[0];
          if (firstArg && firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
            addFinding('MEDIUM', 'Code Injection',
              `${callee.name}() called with string argument — behaves like eval()`, node, {
              cwe: 'CWE-95', owasp: 'A03:2021',
            });
          }
        }
      },

      // ── Prototype mutation ────────────────────────────────────────────────
      AssignmentExpression(node) {
        const left = node.left;
        if (
          left.type === 'MemberExpression' &&
          left.object?.type === 'MemberExpression' &&
          left.object?.property?.name === 'prototype'
        ) {
          addFinding('HIGH', 'Prototype Pollution',
            `Direct mutation of ${left.object.object?.name || '?'}.prototype`, node, {
            cwe: 'CWE-1321', owasp: 'A03:2021',
          });
        }

        // __proto__ assignment
        if (
          left.type === 'MemberExpression' &&
          left.property?.name === '__proto__'
        ) {
          addFinding('CRITICAL', 'Prototype Pollution',
            '__proto__ assignment detected — prototype pollution', node, {
            cwe: 'CWE-1321', owasp: 'A03:2021',
          });
        }
      },

      // ── innerHTML assignments ─────────────────────────────────────────────
      MemberExpression(node) {
        if (
          node.property?.type === 'Identifier' &&
          ['innerHTML', 'outerHTML'].includes(node.property.name)
        ) {
          // Only flag when used as assignment target — check parent
          addFinding('HIGH', 'XSS',
            `${node.property.name} access — verify it's not assigned unsanitized user data`, node, {
            cwe: 'CWE-79', owasp: 'A03:2021',
          });
        }
      },
    });

    return JSON.stringify({
      filePath,
      findingsCount: findings.length,
      findings,
    });
  },
});

module.exports = { astScanFileTool };
