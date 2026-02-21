# 🛡️ Security Audit: https://pbl-project-3.onrender.com/
> **ID**: caf2dd03-d832-4c9e-b616-8dc04e0b5271 | **Date**: 2026-02-21 | **Findings**: 18

| Sev | 🔴 Crit | 🟠 High | 🟡 Med | 🔵 Low | ⚪ Info |
|---|---|---|---|---|---|
| **Amt** | 0 | 4 | 4 | 10 | 0 |

### 📋 Findings Summary
| # | Sev | Type | Endpoint |
|---|---|---|---|
| 1 | 🟠 | Authentication Weakness | `https://pbl-project-3.onrender.com/$%7BYe%7D/api/a...` |
| 2 | 🟠 | Authentication Weakness | `https://pbl-project-3.onrender.com/$%7BYe%7D/api/a...` |
| 3 | 🟠 | Authentication Weakness | `https://pbl-project-3.onrender.com/$%7BYe%7D/api/a...` |
| 4 | 🟠 | Authentication Weakness | `https://pbl-project-3.onrender.com/$%7BYe%7D/api/a...` |
| 5 | 🟡 | Information Disclosure | `https://pbl-project-3.onrender.com/` |
| 6 | 🟡 | Information Disclosure (Secrets) | `https://pbl-project-3.onrender.com/assets/index-D_...` |
| 7 | 🟡 | Information Disclosure (Secrets) | `https://pbl-project-3.onrender.com/assets/index-D_...` |
| 8 | 🟡 | Information Disclosure (Secrets) | `https://pbl-project-3.onrender.com/assets/index-D_...` |
| 9 | 🔵 | Missing Security Header | `https://pbl-project-3.onrender.com/` |
| 10 | 🔵 | Missing Security Header | `https://pbl-project-3.onrender.com/` |
| 11 | 🔵 | Missing Security Header | `https://pbl-project-3.onrender.com/` |
| 12 | 🔵 | Missing Security Header | `https://pbl-project-3.onrender.com/` |
| 13 | 🔵 | Missing Security Header | `https://pbl-project-3.onrender.com/` |
| 14 | 🔵 | Missing Security Header | `https://pbl-project-3.onrender.com/` |
| 15 | 🔵 | Missing Security Header | `https://pbl-project-3.onrender.com/` |
| 16 | 🔵 | Missing Security Header | `https://pbl-project-3.onrender.com/` |
| 17 | 🔵 | Missing Security Header | `https://pbl-project-3.onrender.com/` |
| 18 | 🔵 | Logging Failure | `https://pbl-project-3.onrender.com/` |

## 🔍 Technical Evidence & Remediation
### 1. Authentication Weakness [🟠 High]
**Description**: Successful login with feasible credential: admin
| Endpoint | Proof / Evidence |
|---|---|
| `https://pbl-project-3.onrender.com/$%7BYe%7D/api/auth/superadmin/login` | `Credential: {"username":"admin","password":"password"}. Indicator: Coo...` |
| `https://pbl-project-3.onrender.com/$%7BYe%7D/api/auth/signup` | `Credential: {"username":"admin","password":"password"}. Indicator: Coo...` |
| `https://pbl-project-3.onrender.com/$%7BYe%7D/api/auth/login` | `Credential: {"username":"admin","password":"password"}. Indicator: Coo...` |
| `https://pbl-project-3.onrender.com/$%7BYe%7D/api/auth/slug/$%7Bm%7D` | `Credential: {"username":"admin","password":"password"}. Indicator: Coo...` |

**Fix & Simulation:**
Use strong password policies. Implement MFA. Use secure session management.
---

### 2. Information Disclosure (server) [🟡 Medium]
**Description**: Server information disclosure via server header
| Endpoint | Proof / Evidence |
|---|---|
| `https://pbl-project-3.onrender.com/` | `server: cloudflare` |

**Fix & Simulation:**
Remove verbose error messages. Disable directory listing. Remove server headers.
---

### 3. Information Disclosure (Secrets) (Generic API Key) [🟡 Medium]
**Description**: Sensitive Generic API Key discovered in JavaScript file
| Endpoint | Proof / Evidence |
|---|---|
| `https://pbl-project-3.onrender.com/assets/index-D_j_dHJl.js` | `Source: JavaScript file. Match: reac...date` |

**Fix & Simulation:**
Review and apply security best practices for this vulnerability type.
---

### 4. Information Disclosure (Secrets) (Hardcoded Credential) [🟡 Medium]
**Description**: Sensitive Hardcoded Credential discovered in JavaScript file
| Endpoint | Proof / Evidence |
|---|---|
| `https://pbl-project-3.onrender.com/assets/index-D_j_dHJl.js` | `Source: JavaScript file. Match: Key:...ied"` |

**Fix & Simulation:**
Review and apply security best practices for this vulnerability type.
---

### 5. Information Disclosure (Secrets) (Internal File Path) [🟡 Medium]
**Description**: Sensitive Internal File Path discovered in JavaScript file
| Endpoint | Proof / Evidence |
|---|---|
| `https://pbl-project-3.onrender.com/assets/index-D_j_dHJl.js` | `Source: JavaScript file. Match: /www.../svg` |

**Fix & Simulation:**
Review and apply security best practices for this vulnerability type.
---

### 6. Missing Security Header (content-security-policy) [🔵 Low]
**Description**: Missing security header: CSP (Content Security Policy)
| Endpoint | Proof / Evidence |
|---|---|
| `https://pbl-project-3.onrender.com/` | `Header "content-security-policy" not present in response` |

**Fix & Simulation:**
Add recommended security headers: CSP, X-Frame-Options, HSTS, etc.
---

### 7. Missing Security Header (x-frame-options) [🔵 Low]
**Description**: Missing security header: X-Frame-Options (Clickjacking protection)
| Endpoint | Proof / Evidence |
|---|---|
| `https://pbl-project-3.onrender.com/` | `Header "x-frame-options" not present in response` |

**Fix & Simulation:**
Add recommended security headers: CSP, X-Frame-Options, HSTS, etc.
---

### 8. Missing Security Header (x-xss-protection) [🔵 Low]
**Description**: Missing security header: X-XSS-Protection (XSS filter)
| Endpoint | Proof / Evidence |
|---|---|
| `https://pbl-project-3.onrender.com/` | `Header "x-xss-protection" not present in response` |

**Fix & Simulation:**
Add recommended security headers: CSP, X-Frame-Options, HSTS, etc.
---

### 9. Missing Security Header (referrer-policy) [🔵 Low]
**Description**: Missing security header: Referrer-Policy (Controls referrer information)
| Endpoint | Proof / Evidence |
|---|---|
| `https://pbl-project-3.onrender.com/` | `Header "referrer-policy" not present in response` |

**Fix & Simulation:**
Add recommended security headers: CSP, X-Frame-Options, HSTS, etc.
---

### 10. Missing Security Header (permissions-policy) [🔵 Low]
**Description**: Missing security header: Permissions-Policy (Controls browser features)
| Endpoint | Proof / Evidence |
|---|---|
| `https://pbl-project-3.onrender.com/` | `Header "permissions-policy" not present in response` |

**Fix & Simulation:**
Add recommended security headers: CSP, X-Frame-Options, HSTS, etc.
---

### 11. Missing Security Header (cross-origin-embedder-policy) [🔵 Low]
**Description**: Missing security header: COEP (Cross-Origin Embedder Policy)
| Endpoint | Proof / Evidence |
|---|---|
| `https://pbl-project-3.onrender.com/` | `Header "cross-origin-embedder-policy" not present in response` |

**Fix & Simulation:**
Add recommended security headers: CSP, X-Frame-Options, HSTS, etc.
---

### 12. Missing Security Header (cross-origin-opener-policy) [🔵 Low]
**Description**: Missing security header: COOP (Cross-Origin Opener Policy)
| Endpoint | Proof / Evidence |
|---|---|
| `https://pbl-project-3.onrender.com/` | `Header "cross-origin-opener-policy" not present in response` |

**Fix & Simulation:**
Add recommended security headers: CSP, X-Frame-Options, HSTS, etc.
---

### 13. Missing Security Header (cross-origin-resource-policy) [🔵 Low]
**Description**: Missing security header: CORP (Cross-Origin Resource Policy)
| Endpoint | Proof / Evidence |
|---|---|
| `https://pbl-project-3.onrender.com/` | `Header "cross-origin-resource-policy" not present in response` |

**Fix & Simulation:**
Add recommended security headers: CSP, X-Frame-Options, HSTS, etc.
---

### 14. Missing Security Header (x-permitted-cross-domain-policies) [🔵 Low]
**Description**: Missing security header: X-Permitted-Cross-Domain-Policies (Restricts Flash/PDF cross-domain policy files)
| Endpoint | Proof / Evidence |
|---|---|
| `https://pbl-project-3.onrender.com/` | `Header "x-permitted-cross-domain-policies" not present in response` |

**Fix & Simulation:**
Add recommended security headers: CSP, X-Frame-Options, HSTS, etc.
---

### 15. Logging Failure (Rate Limiting) [🔵 Low]
**Description**: No rate limiting detected on rapid requests
| Endpoint | Proof / Evidence |
|---|---|
| `https://pbl-project-3.onrender.com/` | `5 rapid requests all returned non-429 responses` |

**Fix & Simulation:**
Implement centralized logging. Monitor for anomalies. Hide error details in production.
---

## 💡 Key Recommendations
- 4 high-severity issues should be resolved before deployment.
- Add all recommended security headers (CSP, HSTS, X-Frame-Options, etc.).
- Strengthen authentication mechanisms and session management.

*Generated by VulnSight-AI — Agentic Security Auditor*