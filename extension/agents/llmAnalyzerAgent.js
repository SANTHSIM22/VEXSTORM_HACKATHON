/**
 * LLM ANALYZER AGENT
 * Responsibility: Deep context-aware vulnerability analysis using Mistral AI.
 * Analyzes files in batches, reasoning about cross-file vulnerabilities,
 * business logic flaws, and issues that regex cannot detect.
 *
 * Implements a ReAct (Reason + Act) loop via LangChain tool-calling.
 */

'use strict';

const { ChatMistralAI }      = require('@langchain/mistralai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { readFileTool }       = require('../tools/fileSystemTools');
const { patternScanFileTool } = require('../tools/patternScanTools');
const { secretScanFileTool }  = require('../tools/secretScanTools');

const SYSTEM_PROMPT = `You are a Senior Security Engineer conducting a thorough security audit.
Your task is to analyze source code files and identify ALL security vulnerabilities.

For each vulnerability found, provide:
1. Severity: CRITICAL / HIGH / MEDIUM / LOW
2. Category: (e.g., SQL Injection, XSS, IDOR, Command Injection, etc.)
3. Description: Clear explanation of the vulnerability
4. File and line number
5. Code snippet showing the vulnerable code
6. CWE ID (e.g., CWE-89)
7. OWASP category (e.g., A03:2021)
8. Proof of Concept: How an attacker could exploit this
9. Fix: Specific code fix recommendation

Focus on:
- Authentication/Authorization flaws (missing auth checks, IDOR)
- Injection vulnerabilities (SQL, Command, SSTI, XSS)
- Insecure cryptography (weak algorithms, hardcoded secrets)
- Business logic flaws
- Data exposure (PII, credentials in responses)
- Race conditions
- OWASP Top 10 issues

IMPORTANT: Be thorough. Look for subtle issues that automated tools miss.
Return findings as a JSON array in this format:
[
  {
    "severity": "CRITICAL",
    "category": "SQL Injection",
    "description": "...",
    "file": "path/to/file.js",
    "line": 42,
    "snippet": "vulnerable code here",
    "cwe": "CWE-89",
    "owasp": "A03:2021",
    "poc": "Payload: ' OR 1=1--",
    "fix": "Use parameterized queries: db.prepare('SELECT * FROM users WHERE id = ?').get(id)"
  }
]`;

class LLMAnalyzerAgent {
  constructor(apiKey, model, logger) {
    this.name = 'LLMAnalyzerAgent';
    this.logger = logger || console.log;
    this.batchSize = 3; // Analyze N files per LLM call

    this.llm = new ChatMistralAI({
      apiKey: apiKey,
      model: model || 'mistral-large-latest',
      temperature: 0.1, // Low temperature for consistent security analysis
      maxTokens: 4096,
    });
  }

  log(msg) {
    this.logger(`[LLMAnalyzerAgent] ${msg}`);
  }

  /**
   * Analyze a batch of files with one LLM call.
   */
  async analyzeFileBatch(files, context = '') {
    const fileBlocks = files.map((f) => {
      const snippet = f.content.length > 6000
        ? f.content.slice(0, 6000) + '\n... [TRUNCATED]'
        : f.content;
      return `### File: ${f.filePath}\n\`\`\`${f.extension?.replace('.', '') || 'text'}\n${snippet}\n\`\`\``;
    }).join('\n\n---\n\n');

    const userPrompt = `${context ? `Context: ${context}\n\n` : ''}Analyze these files for security vulnerabilities:\n\n${fileBlocks}\n\nReturn ONLY a JSON array of findings. If no vulnerabilities found, return [].`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(userPrompt),
      ]);

      const raw = response.content;
      const text = typeof raw === 'string'
        ? raw
        : Array.isArray(raw)
          ? raw.map((c) => (typeof c === 'string' ? c : (c.type === 'text' ? c.text : ''))).join('')
          : '';

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.log('Warning: No JSON array found in LLM response');
        return [];
      }

      const findings = JSON.parse(jsonMatch[0]);
      return Array.isArray(findings) ? findings : [];
    } catch (e) {
      this.log(`LLM analysis error: ${e.message}`);
      return [];
    }
  }

  /**
   * Analyze high-priority files first (auth, routes, configs, .env).
   */
  prioritizeFiles(files) {
    const priority = (f) => {
      const name = f.fileName?.toLowerCase() || '';
      const path = f.filePath?.toLowerCase() || '';
      if (name === '.env' || name.startsWith('.env')) return 0;
      if (path.includes('auth') || path.includes('login') || path.includes('password')) return 1;
      if (path.includes('api') || path.includes('routes') || path.includes('controller')) return 2;
      if (path.includes('middleware') || path.includes('admin')) return 3;
      if (path.includes('config') || f.extension === '.json') return 4;
      return 5;
    };
    return [...files].sort((a, b) => priority(a) - priority(b));
  }

  /**
   * Cross-file analysis: look for auth bypasses that span multiple files.
   */
  async analyzeCrossFile(scannerResult, patternResults) {
    this.log('Running cross-file analysis for auth/logic vulnerabilities...');

    // Build a summary context from pattern results
    const topIssues = [
      ...patternResults.patternFindings.slice(0, 5),
      ...patternResults.secretFindings.slice(0, 3),
    ].map((f) => `- ${f.category || f.name}: ${f.description} in ${f.file?.split(/[\\/]/).pop()}:${f.line}`).join('\n');

    const authFiles = scannerResult.allFiles.filter((f) => {
      const p = (f.filePath || '').toLowerCase();
      return p.includes('auth') || p.includes('middleware') || p.includes('session');
    }).slice(0, 4);

    if (authFiles.length === 0) return [];

    const prompt = `You already found these issues via regex:\n${topIssues}\n\nNow look at the authentication/authorization flow across these files for LOGICAL vulnerabilities — auth bypass, privilege escalation, broken session management, token reuse, etc.`;

    return this.analyzeFileBatch(authFiles, prompt);
  }

  /**
   * Main entry point.
   * @param {object} scannerResult - From ScannerAgent
   * @param {object} patternResults - From PatternAnalysisAgent
   * @param {object} options - { maxFiles, onProgress }
   */
  async run(scannerResult, patternResults, options = {}) {
    const t0 = Date.now();
    const allFindings = [];
    const onProgress = options.onProgress || (() => {});

    // Prioritize + limit files for LLM analysis (expensive)
    const prioritized = this.prioritizeFiles(scannerResult.allFiles || []);
    const toAnalyze = prioritized.slice(0, options.maxFiles || 30);

    this.log(`LLM analyzing ${toAnalyze.length} files in batches of ${this.batchSize}...`);

    // Batch analysis
    for (let i = 0; i < toAnalyze.length; i += this.batchSize) {
      const batch = toAnalyze.slice(i, i + this.batchSize);
      const batchNum = Math.floor(i / this.batchSize) + 1;
      const totalBatches = Math.ceil(toAnalyze.length / this.batchSize);

      this.log(`Analyzing batch ${batchNum}/${totalBatches}: ${batch.map((f) => f.fileName).join(', ')}`);
      onProgress({ current: i + batch.length, total: toAnalyze.length, stage: 'LLM Analysis' });

      const findings = await this.analyzeFileBatch(batch);
      allFindings.push(...findings);

      this.log(`Batch ${batchNum} complete — found ${findings.length} issues`);

      // Small delay to respect rate limits
      if (i + this.batchSize < toAnalyze.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Cross-file analysis
    try {
      const crossFindings = await this.analyzeCrossFile(scannerResult, patternResults);
      allFindings.push(...crossFindings.map((f) => ({ ...f, source: 'Cross-File Analysis' })));
      this.log(`Cross-file analysis found ${crossFindings.length} additional issues`);
    } catch (e) {
      this.log(`Cross-file analysis error: ${e.message}`);
    }

    const elapsed = Date.now() - t0;
    this.log(`LLM analysis complete in ${elapsed}ms — ${allFindings.length} total findings`);

    return {
      llmFindings: allFindings,
      stats: { findings: allFindings.length, filesAnalyzed: toAnalyze.length, durationMs: elapsed },
    };
  }
}

module.exports = LLMAnalyzerAgent;
