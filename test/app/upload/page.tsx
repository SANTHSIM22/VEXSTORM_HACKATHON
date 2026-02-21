"use client";
// ⚠️ VULNERABILITY: Unrestricted File Upload
// VULN-066: No file type restriction (any extension including .js, .html)
// VULN-067: Files accessible at /uploads/<filename>
// VULN-068: Filename path traversal (../../lib/db.ts)
// VULN-025: Server path returned in response

import { useState } from "react";

export default function UploadPage() {
  const [file, setFile]     = useState<File | null>(null);
  const [filename, setFilename] = useState(""); // for path traversal demo
  const [result, setResult] = useState("");

  const normalUpload = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res  = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
  };

  // VULN-068: Rename to path traversal target before upload
  const traversalUpload = async () => {
    if (!file) return;
    const renamedFile = new File([file], filename || file.name, { type: file.type });
    const fd = new FormData();
    fd.append("file", renamedFile);
    const res  = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">File Upload</h1>
        <div className="text-red-400 text-sm mb-6 space-y-1">
          <p>VULN-066: No file type validation — upload .html, .js, anything</p>
          <p>VULN-067: Files stored in /public/uploads/ — directly accessible</p>
          <p>VULN-068: Path traversal — use filename like <code>../../lib/db.ts</code></p>
        </div>

        <div className="bg-gray-800 rounded p-4 mb-4">
          <h2 className="font-bold text-yellow-400 mb-3">Normal Upload</h2>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block mb-3 text-sm text-gray-300"
          />
          <button onClick={normalUpload} className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded text-sm">
            Upload
          </button>
        </div>

        <div className="bg-gray-800 rounded p-4 mb-4">
          <h2 className="font-bold text-yellow-400 mb-3">Path Traversal Upload — VULN-068</h2>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block mb-2 text-sm text-gray-300"
          />
          <input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="../../lib/db.ts"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 font-mono text-sm mb-3"
          />
          <button onClick={traversalUpload} className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded text-sm">
            Upload with Custom Filename
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
