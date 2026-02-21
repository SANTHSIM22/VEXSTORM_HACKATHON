"use client";
// ⚠️ VULNERABILITY: IDOR — loads any user's data based on URL param
// VULN-034: /dashboard?userId=1 loads admin's data including PII
// VULN-075: Token taken from localStorage
// VULN-074: User-controlled data rendered via dangerouslySetInnerHTML

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [userData, setUserData] = useState<Record<string, unknown> | null>(null);
  const [allUsers, setAllUsers] = useState<unknown[]>([]);
  const [error, setError]       = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const params = new URLSearchParams(window.location.search);

    // VULN-034: Loads ANY userId specified in URL — not just the current user
    const userId = params.get("userId") || "1";

    // Fetch specific user (IDOR)
    fetch(`/api/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setUserData)
      .catch((e) => setError(String(e)));

    // VULN-036: Fetch all users — no auth needed
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setAllUsers(d.users || []));
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-red-400 text-sm mb-6">
          VULN-034: Change URL to <code>?userId=1</code> to view admin&apos;s SSN, credit card, API key
        </p>

        {error && <p className="text-red-500 mb-4">{error}</p>}

        {userData && (
          <div className="bg-gray-800 rounded p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-yellow-400">Your Profile (IDOR)</h2>
            {/* VULN-074: dangerouslySetInnerHTML with server data */}
            <div
              dangerouslySetInnerHTML={{
                __html: `
                  <table style="width:100%;border-collapse:collapse;">
                    <tr><td style="color:#9ca3af;padding:4px 0">ID</td><td style="color:#f9fafb">${userData.id}</td></tr>
                    <tr><td style="color:#9ca3af;padding:4px 0">Username</td><td style="color:#f9fafb">${userData.username}</td></tr>
                    <tr><td style="color:#9ca3af;padding:4px 0">Email</td><td style="color:#f9fafb">${userData.email}</td></tr>
                    <tr><td style="color:#ef4444;padding:4px 0">SSN ⚠️</td><td style="color:#fbbf24">${userData.ssn || "N/A"}</td></tr>
                    <tr><td style="color:#ef4444;padding:4px 0">Credit Card ⚠️</td><td style="color:#fbbf24">${userData.creditCard || "N/A"}</td></tr>
                    <tr><td style="color:#ef4444;padding:4px 0">API Key ⚠️</td><td style="color:#fbbf24">${userData.apiKey || "N/A"}</td></tr>
                    <tr><td style="color:#9ca3af;padding:4px 0">Balance</td><td style="color:#f9fafb">$${userData.balance}</td></tr>
                    <tr><td style="color:#9ca3af;padding:4px 0">Role</td><td style="color:#f9fafb">${userData.role}</td></tr>
                  </table>
                `,
              }}
            />
          </div>
        )}

        <div className="bg-gray-800 rounded p-6">
          <h2 className="text-xl font-bold mb-4 text-yellow-400">
            All Users (No Auth Required — VULN-036)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2">ID</th>
                  <th className="text-left py-2">Username</th>
                  <th className="text-left py-2">Email</th>
                  <th className="text-left py-2 text-red-400">SSN</th>
                  <th className="text-left py-2 text-red-400">Credit Card</th>
                  <th className="text-left py-2 text-red-400">Password Hash</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u: unknown) => {
                  const user = u as Record<string, unknown>;
                  return (
                    <tr key={String(user.id)} className="border-b border-gray-700 text-gray-300">
                      <td className="py-2">{String(user.id)}</td>
                      <td className="py-2">{String(user.username)}</td>
                      <td className="py-2">{String(user.email)}</td>
                      <td className="py-2 text-yellow-400">{String(user.ssn ?? "")}</td>
                      <td className="py-2 text-yellow-400">{String(user.creditCard ?? "")}</td>
                      <td className="py-2 text-red-400 font-mono text-xs">{String(user.password)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
