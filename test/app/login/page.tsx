"use client";
// ⚠️ VULNERABILITY: SQL Injection on login form
// VULN-006: Username field value not sanitized before being sent to /api/auth/login
// VULN-075: JWT stored in localStorage
// VULN-016: Password visible in network tab (no HTTPS enforcement on dev)

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [response, setResponse] = useState<string>("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // VULN-006: sends raw username without any client-side sanitization
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }), // password sent in plaintext JSON
    });

    const data = await res.json();
    setResponse(JSON.stringify(data, null, 2));

    if (data.token) {
      // VULN-075: Token stored in localStorage (XSS accessible)
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user)); // ⚠️ includes SSN, CC
      router.push("/dashboard");
    } else {
      setError(data.error || "Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2">Login</h1>
        <p className="text-red-400 text-xs mb-6">
          VULN-006: Try username: <code>{`' OR '1'='1`}</code> to bypass auth
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2"
              placeholder="admin' OR '1'='1"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-red-700 hover:bg-red-600 py-2 rounded font-semibold"
          >
            Login
          </button>
        </form>

        {/* VULN-018: Full server response including stack traces shown in UI */}
        {response && (
          <pre className="mt-6 bg-gray-900 p-4 rounded text-xs text-green-400 overflow-auto max-h-64">
            {response}
          </pre>
        )}

        <div className="mt-4 text-xs text-gray-500">
          <p>Default creds: admin / admin123</p>
          <p className="text-red-400 mt-1">⚠️ SQL injection payload: {`' OR '1'='1`} (any password)</p>
        </div>
      </div>
    </div>
  );
}
