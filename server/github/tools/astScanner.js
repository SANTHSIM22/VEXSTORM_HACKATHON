'use strict';

/**
 * AST SCANNER — standalone plain-JS (no LangChain)
 * Extracted from extension/tools/astScanTools.js
 * Uses acorn + acorn-walk if available, else falls back to regex.
 */

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}
function getLineContent(content, lineNum) {
  return (content.split('\n')[lineNum - 1] || '').trim().slice(0, 140);
}

function regexFallbackScan(filePath, content) {
  const findings = [];
  const patterns = [
    { re: /\beval\s*\(/g,              desc: 'eval() call detected — potential code injection', severity: 'HIGH',     cwe: 'CWE-95',   owasp: 'A03:2021', ruleId: 'AST-EVAL' },
    { re: /new\s+Function\s*\(/g,      desc: 'new Function() — dynamic code execution',       severity: 'HIGH',     cwe: 'CWE-95',   owasp: 'A03:2021', ruleId: 'AST-FUNC' },
    { re: /\.innerHTML\s*=/g,          desc: 'innerHTML assignment — DOM XSS risk',           severity: 'HIGH',     cwe: 'CWE-79',   owasp: 'A03:2021', ruleId: 'AST-INHTML' },
    { re: /\.outerHTML\s*=/g,          desc: 'outerHTML assignment — DOM XSS risk',           severity: 'HIGH',     cwe: 'CWE-79',   owasp: 'A03:2021', ruleId: 'AST-OUTHTML' },
    { re: /__proto__\s*=/g,            desc: '__proto__ assignment — prototype pollution',    severity: 'HIGH',     cwe: 'CWE-1321', owasp: 'A03:2021', ruleId: 'AST-PROTO' },
    { re: /Object\.prototype\.\w+\s*=/g, desc: 'Object.prototype mutation — prototype pollution', severity: 'HIGH', cwe: 'CWE-1321', owasp: 'A03:2021', ruleId: 'AST-OBJPROTO' },
    { re: /require\s*\(\s*(?:req\.|body\.|query\.|params\.)/g, desc: 'Dynamic require() with user input — RCE risk', severity: 'CRITICAL', cwe: 'CWE-95', owasp: 'A03:2021', ruleId: 'AST-DYNREQ' },
    { re: /(?:exec|spawn)\s*\(\s*`[^`]*\$\{/g, desc: 'exec/spawn with template literal — command injection', severity: 'CRITICAL', cwe: 'CWE-78', owasp: 'A03:2021', ruleId: 'AST-EXECTEMPL' },
    { re: /setTimeout\s*\(\s*['"`][^'"`)]/g, desc: 'setTimeout with string argument — code injection', severity: 'HIGH', cwe: 'CWE-95', owasp: 'A03:2021', ruleId: 'AST-SETTIMEOUT' },
    { re: /setInterval\s*\(\s*['"`][^'"`)]/g, desc: 'setInterval with string argument — code injection', severity: 'HIGH', cwe: 'CWE-95', owasp: 'A03:2021', ruleId: 'AST-SETINTERVAL' },
  ];
  for (const { re, desc, severity, cwe, owasp, ruleId } of patterns) {
    const regex = new RegExp(re.source, re.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lineNum = getLineNumber(content, match.index);
      findings.push({ ruleId, category: 'Code Injection', severity, description: desc, cwe, owasp, file: filePath, line: lineNum, snippet: getLineContent(content, lineNum), match: match[0].slice(0, 120), source: 'AST Scan' });
    }
  }
  return findings;
}

/**
 * AST-scan a JS/TS file. Falls back to regex if acorn is unavailable.
 * @param {string} filePath
 * @param {string} content
 * @returns {{ findings: Array }}
 */
function scanAst(filePath, content) {
  let acorn, walk;
  try {
    acorn = require('acorn');
    walk  = require('acorn-walk');
  } catch (_) {
    // acorn not available — use regex fallback
    const findings = regexFallbackScan(filePath, content);
    return { file: filePath, findingsCount: findings.length, findings, method: 'regex-fallback' };
  }

  const findings = [];
  let ast;
  try {
    ast = acorn.parse(content, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true });
  } catch (_) {
    try {
      ast = acorn.parse(content, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowHashBang: true });
    } catch (e2) {
      const fallback = regexFallbackScan(filePath, content);
      return { file: filePath, findingsCount: fallback.length, findings: fallback, method: 'regex-fallback', parseError: e2.message };
    }
  }

  function push(node, ruleId, desc, severity, cwe, owasp) {
    const lineNum = node.loc?.start?.line || 0;
    findings.push({ ruleId, category: 'Code Injection', severity, description: desc, cwe, owasp, file: filePath, line: lineNum, snippet: getLineContent(content, lineNum), source: 'AST Scan' });
  }

  walk.simple(ast, {
    CallExpression(node) {
      const callee = node.callee;
      // eval()
      if (callee.type === 'Identifier' && callee.name === 'eval') {
        push(node, 'AST-EVAL', 'eval() detected — code injection risk', 'HIGH', 'CWE-95', 'A03:2021');
      }
      // exec/spawn with template literal
      if (callee.type === 'MemberExpression' || callee.type === 'Identifier') {
        const name = callee.name || callee.property?.name;
        if (['exec', 'execSync', 'spawn', 'spawnSync'].includes(name)) {
          const firstArg = node.arguments[0];
          if (firstArg && firstArg.type === 'TemplateLiteral') {
            push(node, 'AST-EXEC-TEMPL', 'exec/spawn with template literal — command injection', 'CRITICAL', 'CWE-78', 'A03:2021');
          }
        }
      }
      // dynamic require
      if (callee.type === 'Identifier' && callee.name === 'require') {
        const arg = node.arguments[0];
        if (arg && arg.type !== 'Literal') {
          push(node, 'AST-DYN-REQUIRE', 'Dynamic require() — potential arbitrary module load', 'CRITICAL', 'CWE-95', 'A03:2021');
        }
      }
      // setTimeout / setInterval with string
      if (callee.type === 'Identifier' && ['setTimeout', 'setInterval'].includes(callee.name)) {
        const arg = node.arguments[0];
        if (arg && arg.type === 'Literal' && typeof arg.value === 'string') {
          push(node, 'AST-SETTIMER-STR', `${callee.name}() with string argument — code injection`, 'HIGH', 'CWE-95', 'A03:2021');
        }
      }
    },
    NewExpression(node) {
      if (node.callee.type === 'Identifier' && node.callee.name === 'Function') {
        push(node, 'AST-NEW-FUNC', 'new Function() — dynamic code execution', 'HIGH', 'CWE-95', 'A03:2021');
      }
    },
    AssignmentExpression(node) {
      // innerHTML / outerHTML
      if (node.left.type === 'MemberExpression') {
        const prop = node.left.property?.name;
        if (prop === 'innerHTML') push(node, 'AST-INNERHTML', 'innerHTML assignment — DOM XSS risk', 'HIGH', 'CWE-79', 'A03:2021');
        if (prop === 'outerHTML') push(node, 'AST-OUTERHTML', 'outerHTML assignment — DOM XSS risk', 'HIGH', 'CWE-79', 'A03:2021');
        // __proto__
        if (prop === '__proto__') push(node, 'AST-PROTO', '__proto__ assignment — prototype pollution', 'HIGH', 'CWE-1321', 'A03:2021');
        // Object.prototype.x =
        if (
          node.left.object?.type === 'MemberExpression' &&
          node.left.object?.object?.name === 'Object' &&
          node.left.object?.property?.name === 'prototype'
        ) {
          push(node, 'AST-OBJ-PROTO', 'Object.prototype mutation — prototype pollution', 'HIGH', 'CWE-1321', 'A03:2021');
        }
      }
    },
  });

  return { file: filePath, findingsCount: findings.length, findings, method: 'acorn-ast' };
}

module.exports = { scanAst };
