'use strict';

/**
 * LLM ANALYZER AGENT — GitHub variant
 * Deep context-aware vulnerability analysis using Mistral AI.
 * Uses server's @mistralai/mistralai client directly.
 */

const { Mistral } = require('@mistralai/mistralai');

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
Return findings as a JSON array ONLY. No other text before or after the JSON array.
Format:
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
    "fix": "Use parameterized queries"
  }
]`;

class LLMAnalyzerAgent {
  constructor(apiKey, model, logger) {
    this.name      = 'LLMAnalyzerAgent';
    this.logger    = logger || console.log;
    this.batchSize = 3;
    this.client    = new Mistral({ apiKey: apiKey || process.env.MISTRAL_API_KEY });
    this.model     = model || 'mistral-large-latest';
  }

  log(msg) { this.logger(`[LLMAnalyzerAgent] ${msg}`); }

  async analyzeFileBatch(files, context = '') {
    const fileBlocks = files.map((f) => {
      const snippet = f.content.length > 5000 ? f.content.slice(0, 5000) + '\n... [TRUNCATED]' : f.content;
      return `### File: ${f.filePath}\n\`\`\`${(f.extension || '').replace('.', '') || 'text'}\n${snippet}\n\`\`\``;
    }).join('\n\n---\n\n');

    const userPrompt = `${context ? `Context: ${context}\n\n` : ''}Analyze these files for security vulnerabilities:\n\n${fileBlocks}\n\nReturn ONLY a JSON array of findings. If no vulnerabilities found, return [].`;

    try {
      const response = await this.client.chat.complete({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userPrompt },
        ],
        temperature: 0.1,
        maxTokens:   4096,
      });

      const text = response.choices[0]?.message?.content || '';
      // Extract JSON array from response
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];
      return JSON.parse(match[0]);
    } catch (e) {
      this.log(`LLM batch error: ${e.message}`);
      return [];
    }
  }

  prioritizeFiles(files) {
    const priority = (f) => {
      const name = (f.fileName || '').toLowerCase();
      const fp   = (f.filePath || '').toLowerCase();
      if (name === '.env' || name.startsWith('.env')) return 0;
      if (fp.includes('auth') || fp.includes('login') || fp.includes('password')) return 1;
      if (fp.includes('api') || fp.includes('routes') || fp.includes('controller')) return 2;
      if (fp.includes('middleware') || fp.includes('admin')) return 3;
      if (fp.includes('config') || f.extension === '.json') return 4;
      return 5;
    };
    return [...files].sort((a, b) => priority(a) - priority(b));
  }

  async analyzeCrossFile(scannerResult, patternResults) {
    this.log('Running cross-file analysis...');
    const topIssues = [
      ...(patternResults.patternFindings || []).slice(0, 5),
      ...(patternResults.secretFindings  || []).slice(0, 3),
    ].map((f) => `- ${f.category || f.name}: ${f.description} in ${(f.file || '').split(/[\\/]/).pop()}`).join('\n');

    const authFiles = (scannerResult.allFiles || []).filter((f) => {
      const p = (f.filePath || '').toLowerCase();
      return p.includes('auth') || p.includes('middleware') || p.includes('session');
    }).slice(0, 4);

    if (authFiles.length === 0) return [];

    const prompt = `Known issues:\n${topIssues}\n\nSearch for LOGICAL auth/authorization vulnerabilities across these files.`;
    return this.analyzeFileBatch(authFiles, prompt);
  }

  async run(scannerResult, patternResults, options = {}) {
    const t0          = Date.now();
    const allFindings = [];
    const onProgress  = options.onProgress || (() => {});

    const prioritized = this.prioritizeFiles(scannerResult.allFiles || []);
    const toAnalyze   = prioritized.slice(0, options.maxFiles || 25);

    this.log(`LLM analyzing ${toAnalyze.length} files in batches of ${this.batchSize}...`);

    for (let i = 0; i < toAnalyze.length; i += this.batchSize) {
      const batch    = toAnalyze.slice(i, i + this.batchSize);
      const batchNum = Math.floor(i / this.batchSize) + 1;
      const total    = Math.ceil(toAnalyze.length / this.batchSize);

      this.log(`Analyzing batch ${batchNum}/${total}: ${batch.map((f) => f.fileName || f.filePath).join(', ')}`);
      onProgress({ current: i + batch.length, total: toAnalyze.length });

      const findings = await this.analyzeFileBatch(batch);
      allFindings.push(...findings);

      if (i + this.batchSize < toAnalyze.length) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    // Cross-file analysis
    try {
      const crossFindings = await this.analyzeCrossFile(scannerResult, patternResults);
      allFindings.push(...crossFindings.map((f) => ({ ...f, source: 'Cross-File Analysis' })));
    } catch (e) {
      this.log(`Cross-file analysis error: ${e.message}`);
    }

    const elapsed = Date.now() - t0;
    this.log(`LLM analysis complete in ${elapsed}ms — ${allFindings.length} findings`);

    return {
      llmFindings: allFindings,
      stats: { findings: allFindings.length, filesAnalyzed: toAnalyze.length, durationMs: elapsed },
    };
  }
}

module.exports = LLMAnalyzerAgent;
