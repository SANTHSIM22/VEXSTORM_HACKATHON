"use client";
// ⚠️ VULNERABILITY: Business Logic Flaw — negative amount transfers
// VULN-070: No balance check
// VULN-071: Negative amount reverses transfer, inflating attacker balance
// VULN-072: No CSRF token
// Payload: { toUserId: 1, amount: -99999 } → steal 99999 from admin

import { useState } from "react";

export default function TransferPage() {
  const [toUserId, setToUserId] = useState("1");
  const [amount, setAmount]   = useState("-99999");
  const [result, setResult]   = useState("");

  const transfer = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/transfer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      // VULN-071: negative amount — no server-side validation
      body: JSON.stringify({ toUserId: Number(toUserId), amount: Number(amount) }),
    });
    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold mb-2">Transfer Funds</h1>
        <div className="text-red-400 text-sm mb-6 space-y-1">
          <p>VULN-071: Negative amount steals money from recipient</p>
          <p>VULN-070: No balance check — overdraft unlimited</p>
          <p>VULN-072: No CSRF protection</p>
          <p>Default payload: send -99999 to userId:1 (admin) to steal their balance</p>
        </div>

        <div className="bg-gray-800 rounded p-4 space-y-3 mb-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Recipient User ID</label>
            <input
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Amount <span className="text-red-400">(negative = steal)</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <button onClick={transfer} className="w-full bg-red-700 hover:bg-red-600 py-2 rounded font-semibold">
            Transfer
          </button>
        </div>

        {result && (
          <pre className="bg-gray-800 rounded p-4 text-xs text-green-400 overflow-auto max-h-48">
            {result}
          </pre>
        )}
      </div>
    </div>
  );
}
