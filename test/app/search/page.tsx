"use client";
// ⚠️ VULNERABILITY: Reflected XSS via search input + dangerouslySetInnerHTML
// VULN-074: Search query rendered back into DOM without escaping
// VULN-006: Raw SQL query string shown in results
// VULN-043: Search returns SSN, credit card fields

import { useState } from "react";

export default function SearchPage() {
  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState<Record<string, unknown>[]>([]);
  const [sqlShown, setSqlShown]   = useState("");
  const [rawHtml, setRawHtml]     = useState("");

  const handleSearch = async () => {
    const res  = await fetch(`/api/search?q=${query}&type=users`);
    const data = await res.json();

    setResults(data.results || []);
    setSqlShown(data.simulatedSQL || "");

    // VULN-074: Build HTML string with raw user query embedded
    // Payload: query = <img src=x onerror="alert(1)">
    setRawHtml(`<p>Search results for: <strong>${query}</strong></p>`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Search</h1>
        <p className="text-red-400 text-sm mb-6">
          VULN-074: Input is reflected back via dangerouslySetInnerHTML<br />
          XSS Payload: <code>{`<img src=x onerror="alert(document.cookie)">`}</code>
        </p>

        <div className="flex gap-2 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search term or XSS payload..."
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-4 py-2"
          />
          <button
            onClick={handleSearch}
            className="bg-red-700 hover:bg-red-600 px-6 py-2 rounded"
          >
            Search
          </button>
        </div>

        {/* VULN-074: dangerouslySetInnerHTML with user-controlled query */}
        {rawHtml && (
          <div
            className="bg-yellow-900 border border-yellow-600 rounded p-3 mb-4 text-sm"
            dangerouslySetInnerHTML={{ __html: rawHtml }}
          />
        )}

        {/* VULN-007: SQL query structure leaked to UI */}
        {sqlShown && (
          <div className="bg-gray-800 rounded p-3 mb-4 font-mono text-xs text-green-400">
            [SIMULATED SQL] {sqlShown}
          </div>
        )}

        {results.length > 0 && (
          <div className="bg-gray-800 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700 bg-gray-900">
                  <th className="text-left p-3">User</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3 text-red-400">SSN ⚠️</th>
                  <th className="text-left p-3 text-red-400">Credit Card ⚠️</th>
                  <th className="text-left p-3">Balance</th>
                </tr>
              </thead>
              <tbody>
                {results.map((u) => (
                  <tr key={String(u.id)} className="border-b border-gray-700">
                    <td className="p-3">{String(u.username)}</td>
                    <td className="p-3 text-gray-400">{String(u.email)}</td>
                    <td className="p-3 text-yellow-400">{String(u.ssn ?? "")}</td>
                    <td className="p-3 text-yellow-400">{String(u.creditCard ?? "")}</td>
                    <td className="p-3">${String(u.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
