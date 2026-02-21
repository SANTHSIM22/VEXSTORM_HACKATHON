# ZeroTrace — Multi-Agent AI Security Scanner

ZeroTrace is a VS Code extension that performs automated, in-depth security audits on your codebase using a multi-agent AI pipeline powered by Mistral AI and LangGraph. It deploys 10 specialized security agents to detect vulnerabilities across your entire project — from authentication flaws and injection attacks to cryptographic weaknesses and infrastructure misconfigurations.

---

## Features

### 10 Specialized Security Agents

Each agent focuses on a distinct attack surface and runs as part of an orchestrated pipeline:

| Agent | Scope |
|---|---|
| File Scanner | Discovers and indexes all relevant source files in the workspace |
| Pattern Detection | Regex-based detection of hardcoded secrets, unsafe functions, SQLi, XSS, and CMDi |
| Authentication Analysis | JWT misuse, missing auth guards, session management flaws, RBAC bypass |
| Business Logic | IDOR, privilege escalation, mass assignment, insecure direct object references |
| API Security | Unprotected endpoints, GraphQL introspection exposure, broken object-level authorization |
| Frontend Security | Missing CSP headers, unsafe HTML sinks, open redirects, client-side XSS vectors |
| Infrastructure | Exposed environment files, insecure Docker and CI configurations, missing .gitignore rules |
| Cryptography and Logging | Weak algorithms (MD5, SHA1), missing audit trails, sensitive data written to logs |
| AI Deep Analysis | Mistral-powered contextual reasoning for complex and chained vulnerabilities |
| Verification | Deduplication, false-positive filtering, and final severity scoring |

### Interactive Security Report

- Risk score dashboard with severity breakdown across CRITICAL, HIGH, MEDIUM, LOW, and INFO
- Filterable and searchable findings table with expandable rows
- Per-finding proof-of-concept payloads and remediation guidance with code examples
- OWASP Top 10 mapping and CWE classification for every finding
- Attack chain explorer illustrating how individual flaws combine into full compromises
- Full agent pipeline execution log

### Live Scanning Panel

- Real-time progress panel displaying each agent's status during the scan
- Per-agent elapsed time tracking
- Live output log with timestamped entries

---

## Requirements

- VS Code 1.109.0 or higher
- A Mistral AI API key — obtain one at [console.mistral.ai](https://console.mistral.ai)

---

## Extension Settings

Configure ZeroTrace via File > Preferences > Settings, then search for `zerotrace`.

| Setting | Default | Description |
|---|---|---|
| `zerotrace.mistralApiKey` | (empty) | Your Mistral AI API key |
| `zerotrace.mistralModel` | `mistral-large-latest` | Mistral model to use for AI analysis |
| `zerotrace.maxFileSizeKB` | `200` | Skip files larger than this size in kilobytes |
| `zerotrace.fileExtensions` | `.js .ts .py .php ...` | File extensions to include in the scan |

---

## Usage

1. Open the Command Palette with `Ctrl+Shift+P`.
2. Run **ZeroTrace: Scan Currently Open Workspace** to scan the active workspace, or **ZeroTrace: Run Security Scan on Folder** to select any folder.
3. Monitor the live scanning panel as each agent completes its analysis.
4. Review the interactive HTML report containing all findings, proof-of-concept payloads, and recommended fixes.

---

## Release Notes

### 0.0.1

Initial release of ZeroTrace.

- 10-agent security pipeline with Mistral AI and LangGraph orchestration
- Interactive HTML report with risk scoring, OWASP Top 10 mapping, and proof-of-concept viewer
- Real-time scanning panel with per-agent progress tracking
