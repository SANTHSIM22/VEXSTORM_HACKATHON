"use client";
// ⚠️ VULNERABILITY: RCE via eval(), Prototype Pollution, ReDoS
// VULN-059: Expression string sent to /api/eval which runs eval()
// VULN-060: Merge data with __proto__ keys
// VULN-061: Email regex triggers catastrophic backtracking

import { useState } from "react";

export default function EvalPage() {
  const [expression, setExpression]   = useState("2 + 2");
  const [mergeData, setMergeData]     = useState(`{"__proto__": {"isAdmin": true}}`);
  const [email, setEmail]             = useState("");
  const [serialized, setSerialized]   = useState(`{toString: () => "pwned"}`);
  const [result, setResult]           = useState("");

  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    const body = JSON.stringify({ action, ...extra });
    const res  = await fetch("/api/eval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Code Execution Lab</h1>
        <p className="text-red-400 text-sm mb-6">
          VULN-059: Server-side eval() — RCE via expression input
        </p>

        {/* RCE */}
        <div className="bg-gray-800 rounded p-4 mb-4">
          <h2 className="font-bold text-yellow-400 mb-2">RCE via eval() — VULN-059</h2>
          <p className="text-xs text-gray-400 mb-2">
            Payload: <code>require(&apos;child_process&apos;).execSync(&apos;whoami&apos;).toString()</code>
          </p>
          <input
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 font-mono text-sm mb-2"
          />
          <button onClick={() => call("calculate", { expression })} className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded text-sm">
            Execute
          </button>
        </div>

        {/* Prototype Pollution */}
        <div className="bg-gray-800 rounded p-4 mb-4">
          <h2 className="font-bold text-yellow-400 mb-2">Prototype Pollution — VULN-060</h2>
          <p className="text-xs text-gray-400 mb-2">
            Payload: {`{"__proto__": {"isAdmin": true}}`}
          </p>
          <textarea
            value={mergeData}
            onChange={(e) => setMergeData(e.target.value)}
            rows={3}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 font-mono text-xs mb-2"
          />
          <button
            onClick={() => {
              try { call("merge", { data: JSON.parse(mergeData) }); }
              catch { setResult("Invalid JSON"); }
            }}
            className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded text-sm"
          >
            Merge Object
          </button>
        </div>

        {/* ReDoS */}
        <div className="bg-gray-800 rounded p-4 mb-4">
          <h2 className="font-bold text-yellow-400 mb-2">ReDoS — VULN-061</h2>
          <p className="text-xs text-gray-400 mb-2">
            Payload: <code>aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!</code> (triggers catastrophic backtracking)
          </p>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 font-mono text-sm mb-2"
          />
          <button onClick={() => call("validateEmail", { email })} className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded text-sm">
            Validate Email
          </button>
        </div>

        {/* Insecure Deserialization */}
        <div className="bg-gray-800 rounded p-4 mb-4">
          <h2 className="font-bold text-yellow-400 mb-2">Insecure Deserialization — VULN-062</h2>
          <input
            value={serialized}
            onChange={(e) => setSerialized(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 font-mono text-sm mb-2"
          />
          <button onClick={() => call("deserialize", { serialized })} className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded text-sm">
            Deserialize
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
