"use client";
// ⚠️ VULNERABILITY: Reflected + DOM-based XSS
// VULN-074: URLSearchParams value injected into dangerouslySetInnerHTML
// VULN-075: localStorage used to store JWTs (accessible to XSS)
// VULN-076: Inline event handlers built from user input

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [searchResult, setSearchResult] = useState("");
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    // VULN-074: URL param reflected directly into DOM
    const params = new URLSearchParams(window.location.search);
    const name = params.get("name") || "";
    // ⚠️ Payload: /?name=<img src=x onerror=alert(document.cookie)>
    setGreeting(name);

    // VULN-075: Token stored in localStorage
    const token = localStorage.getItem("token");
    if (token) {
      fetch(`/api/users`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then(console.log); // VULN-007: logs all users to console
    }
  }, []);

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value;
    const res = await fetch(`/api/search?q=${q}`); // VULN-076: q not encoded
    const data = await res.json();
    // VULN-074: API response reflected into innerHTML
    setSearchResult(JSON.stringify(data.results));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-red-400 mb-2">⚠️ VulnApp</h1>
        <p className="text-gray-400 mb-8">Deliberately Vulnerable Next.js App — For Security Testing Only</p>

        {/* VULN-074: dangerouslySetInnerHTML with URL-controlled value */}
        {greeting && (
          <div
            className="bg-yellow-900 border border-yellow-600 p-4 rounded mb-6"
            dangerouslySetInnerHTML={{ __html: `Welcome, ${greeting}!` }}
          />
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {[
            { href: "/login",      label: "Login",          vuln: "SQL Injection, VULN-006" },
            { href: "/search",     label: "Search",         vuln: "XSS, SQL Injection" },
            { href: "/dashboard",  label: "Dashboard",      vuln: "IDOR, VULN-034" },
            { href: "/profile/1",  label: "Profile",        vuln: "IDOR, PII Leak" },
            { href: "/admin",      label: "Admin Panel",    vuln: "Broken Access Control" },
            { href: "/comments",   label: "Comments",       vuln: "Stored XSS" },
            { href: "/upload",     label: "Upload",         vuln: "Unrestricted Upload" },
            { href: "/transfer",   label: "Transfer",       vuln: "Business Logic Flaw" },
            { href: "/eval",       label: "Calculator",     vuln: "RCE via eval()" },
            { href: "/tools",      label: "Security Labs",  vuln: "SSRF, Path Traversal, CMDi" },
          ].map(({ href, label, vuln }) => (
            <Link
              key={href}
              href={href}
              className="block bg-gray-800 border border-red-800 rounded p-4 hover:bg-gray-700"
            >
              <div className="font-bold text-white">{label}</div>
              <div className="text-xs text-red-400 mt-1">{vuln}</div>
            </Link>
          ))}
        </div>

        <form onSubmit={handleSearch} className="mb-4">
          <div className="flex gap-2">
            <input
              name="q"
              placeholder="Search users..."
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-4 py-2 text-white"
            />
            <button type="submit" className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded text-white">
              Search
            </button>
          </div>
        </form>

        {/* VULN-074: Search result injected as innerHTML */}
        {searchResult && (
          <div
            className="bg-gray-800 rounded p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: searchResult }}
          />
        )}

        <div className="mt-8 bg-gray-800 rounded p-4 text-sm">
          <p className="text-yellow-400 font-bold mb-2">Vulnerability Index (73+ CVEs)</p>
          <ul className="text-gray-400 space-y-1 text-xs columns-2">
            <li>VULN-001..004 — Hardcoded secrets</li>
            <li>VULN-005 — MD5 password hashing</li>
            <li>VULN-006 — SQL Injection</li>
            <li>VULN-007 — Query/credential logging</li>
            <li>VULN-008 — JWT alg:none bypass</li>
            <li>VULN-009 — No token expiry</li>
            <li>VULN-010 — JWT in localStorage</li>
            <li>VULN-011 — Predictable reset tokens</li>
            <li>VULN-013 — Timing-unsafe comparison</li>
            <li>VULN-014 — PII in API responses</li>
            <li>VULN-015 — Forgeable admin check</li>
            <li>VULN-016 — Credential logging</li>
            <li>VULN-017 — Username enumeration</li>
            <li>VULN-018 — Stack traces in responses</li>
            <li>VULN-019 — Mass Assignment</li>
            <li>VULN-020 — No password policy</li>
            <li>VULN-022 — Role escalation on register</li>
            <li>VULN-023 — Command Injection</li>
            <li>VULN-026 — Path Traversal</li>
            <li>VULN-030 — Arbitrary file write</li>
            <li>VULN-031 — SSRF</li>
            <li>VULN-034 — IDOR</li>
            <li>VULN-036 — No auth on user list</li>
            <li>VULN-040 — No CSRF protection</li>
            <li>VULN-043 — SSN searchable</li>
            <li>VULN-044 — Private posts exposed</li>
            <li>VULN-046/048 — Stored XSS</li>
            <li>VULN-050 — Broken access control</li>
            <li>VULN-052 — Env var dump</li>
            <li>VULN-054 — Backdoor endpoint</li>
            <li>VULN-059 — RCE via eval()</li>
            <li>VULN-060 — Prototype Pollution</li>
            <li>VULN-061 — ReDoS</li>
            <li>VULN-063 — Open Redirect</li>
            <li>VULN-066..068 — Unrestricted Upload</li>
            <li>VULN-070..073 — Business Logic</li>
            <li>VULN-074 — DOM XSS</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Dead code with more embedded secrets (VULN-004) ──────────────────────
// const GITHUB_TOKEN = "ghp_abc123DEF456ghi789JKL012mno345PQR";
// const SLACK_WEBHOOK = "https://hooks.example.com/services/REDACTED_FOR_DEMO";
// const DATABASE_URL = "postgresql://admin:Admin@123@prod-db.internal:5432/appdb";
// These would be picked up by secret scanners easily.

function _unusedAdminHelper() {
  // VULN-054: Backdoor function never removed from prod build
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (global as any).__SECRET_ADMIN_BYPASS__;
}
