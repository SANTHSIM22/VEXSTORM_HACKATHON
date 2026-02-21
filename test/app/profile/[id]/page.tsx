"use client";
// ⚠️ VULNERABILITY: IDOR — profile ID comes from URL, no ownership check
// VULN-034: /profile/2 shows alice's SSN and credit card to any user
// VULN-074: Profile data rendered via dangerouslySetInnerHTML

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ProfilePage() {
  const params = useParams();
  const id     = params?.id as string;
  const [user, setUser] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    // VULN-034: fetches /api/users/:id — no auth, no ownership check
    fetch(`/api/users/${id}`)
      .then((r) => r.json())
      .then(setUser);
  }, [id]);

  if (!user) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold mb-2">User Profile</h1>
        <p className="text-red-400 text-sm mb-6">
          VULN-034 IDOR: Change URL to /profile/1, /profile/2, /profile/3<br />
          Each shows that user&apos;s SSN, credit card, password hash without auth
        </p>

        {/* VULN-074: dangerouslySetInnerHTML with user data from server */}
        <div
          className="bg-gray-800 rounded p-6"
          dangerouslySetInnerHTML={{
            __html: `
              <div style="display:grid;gap:12px">
                <div style="font-size:1.5rem;font-weight:bold;color:#f9fafb">${user.username}</div>
                <div style="color:#9ca3af">${user.email}</div>
                <hr style="border-color:#374151"/>
                <div><span style="color:#9ca3af">Role: </span><span style="color:#f9fafb">${user.role}</span></div>
                <div><span style="color:#9ca3af">Balance: </span><span style="color:#f9fafb">$${user.balance}</span></div>
                <div style="color:#ef4444;font-weight:bold">⚠️ Sensitive PII Exposed:</div>
                <div><span style="color:#9ca3af">SSN: </span><span style="color:#fbbf24">${user.ssn || "N/A"}</span></div>
                <div><span style="color:#9ca3af">Credit Card: </span><span style="color:#fbbf24">${user.creditCard || "N/A"}</span></div>
                <div><span style="color:#9ca3af">Password Hash: </span><span style="color:#f87171;font-family:monospace;font-size:0.75rem">${user.password}</span></div>
                <div><span style="color:#9ca3af">API Key: </span><span style="color:#fbbf24">${user.apiKey || "N/A"}</span></div>
              </div>
            `,
          }}
        />
      </div>
    </div>
  );
}
