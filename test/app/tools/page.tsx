"use client";
// ⚠️ VULNERABILITY: SSRF + Path Traversal + Command Injection labs
// VULN-031: Fetch any URL including internal metadata endpoints
// VULN-026: Read any file on the server filesystem
// VULN-023: Execute arbitrary commands via ping endpoint

import { useState } from "react";

export default function ToolsPage() {
  const [ssrfUrl, setSsrfUrl]       = useState("http://169.254.169.254/latest/meta-data/");
  const [fileTarget, setFileTarget] = useState("../../lib/db.ts");
  const [cmdHost, setCmdHost]       = useState("localhost; id");
  const [result, setResult]         = useState("");

  const callApi = async (url: string) => {
    const res  = await fetch(url);
    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Security Tool Labs</h1>

        {/* SSRF */}
        <div className="bg-gray-800 rounded p-4 mb-4">
          <h2 className="font-bold text-yellow-400 mb-1">SSRF — VULN-031</h2>
          <p className="text-xs text-red-400 mb-2">Fetches any URL from the server. Try AWS metadata, Redis, internal services.</p>
          <input
            value={ssrfUrl}
            onChange={(e) => setSsrfUrl(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 font-mono text-sm mb-2"
          />
          <button
            onClick={() => callApi(`/api/fetch?url=${encodeURIComponent(ssrfUrl)}`)}
            className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded text-sm"
          >
            Fetch
          </button>
        </div>

        {/* Path Traversal */}
        <div className="bg-gray-800 rounded p-4 mb-4">
          <h2 className="font-bold text-yellow-400 mb-1">Path Traversal — VULN-026</h2>
          <p className="text-xs text-red-400 mb-2">Reads any file. Try ../../lib/db.ts to expose secrets.</p>
          <input
            value={fileTarget}
            onChange={(e) => setFileTarget(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 font-mono text-sm mb-2"
          />
          <button
            onClick={() => callApi(`/api/files?file=${encodeURIComponent(fileTarget)}`)}
            className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded text-sm"
          >
            Read File
          </button>
        </div>

        {/* Command Injection */}
        <div className="bg-gray-800 rounded p-4 mb-4">
          <h2 className="font-bold text-yellow-400 mb-1">Command Injection — VULN-023</h2>
          <p className="text-xs text-red-400 mb-2">
            Host injected into ping command. Payload: <code>localhost; whoami</code> or <code>localhost &amp;&amp; cat /etc/passwd</code>
          </p>
          <input
            value={cmdHost}
            onChange={(e) => setCmdHost(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 font-mono text-sm mb-2"
          />
          <button
            onClick={() => callApi(`/api/exec?host=${encodeURIComponent(cmdHost)}`)}
            className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded text-sm"
          >
            Execute
          </button>
        </div>

        {result && (
          <pre className="bg-gray-800 rounded p-4 text-xs text-green-400 overflow-auto max-h-64">
            {result}
          </pre>
        )}
      </div>
    </div>
  );
}
