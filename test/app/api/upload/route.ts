// ⚠️ VULNERABILITY: Insecure File Upload
// VULN-066: No file type validation (accepts any file including .php, .js)
// VULN-067: File stored in publicly accessible directory
// VULN-068: Original filename used without sanitization (path traversal)
// VULN-069: No file size limit

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  // VULN-047: No authentication check
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  // VULN-068: Use original filename directly (path traversal)
  // Payload: filename = "../../lib/db.ts" → overwrites source files
  const filename = file.name; // ⚠️ not sanitized
  
  // VULN-066: No MIME type or extension check
  // VULN-067: Saved to public/ directory — directly accessible via HTTP
  const uploadPath = path.join(process.cwd(), "public", "uploads", filename);

  // VULN-069: No size limit
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
  fs.writeFileSync(uploadPath, buffer);

  // VULN-025: Returns full server path
  return NextResponse.json({
    message: "File uploaded",
    filename,
    path: uploadPath,           // ⚠️ server path disclosed
    url: `/uploads/${filename}`,
    size: buffer.length,
  });
}
