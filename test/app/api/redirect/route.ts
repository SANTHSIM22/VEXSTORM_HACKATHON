// ⚠️ VULNERABILITY: Open Redirect
// VULN-063: Redirects to any user-supplied URL without validation
// VULN-064: Can redirect to javascript: URLs → XSS
// VULN-065: Host header injection for redirect target

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const returnUrl = searchParams.get("returnUrl") || "/";
  const ref = req.headers.get("referer") || "";

  // VULN-063: No validation of returnUrl
  // Payload: /api/redirect?returnUrl=https://evil.com
  // VULN-064: Payload: /api/redirect?returnUrl=javascript:alert(document.cookie)
  console.log(`[REDIRECT] from ${ref} → ${returnUrl}`);

  return NextResponse.redirect(returnUrl);
}
