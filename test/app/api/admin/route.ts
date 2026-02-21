// ⚠️ VULNERABILITY: Broken Access Control on Admin endpoints
// VULN-050: Admin check done only on JWT payload claim (forgeable)
// VULN-051: Sensitive operations exposed without proper RBAC
// VULN-052: Debug endpoint leaks env variables and server info
// VULN-053: No CSRF protection on state-changing operations

import { NextRequest, NextResponse } from "next/server";
import { users, posts } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import os from "os";
import process from "process";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.split(" ")[1] || "";

  // VULN-050: isAdmin only checks JWT claim — attacker can forge alg:none token with role:admin
  if (!isAdmin(token)) {
    // VULN-039: Leaks that the endpoint exists and what actions are available
    return NextResponse.json({
      error: "Admin required",
      hint: "Try actions: debug, users, resetPasswords, backdoor",
    }, { status: 403 });
  }

  if (action === "debug") {
    // VULN-052: Dumps all environment variables
    return NextResponse.json({
      env: process.env,          // ⚠️ ALL env vars including secrets
      platform: os.platform(),
      hostname: os.hostname(),
      cpus: os.cpus(),
      networkInterfaces: os.networkInterfaces(), // ⚠️ internal IPs leaked
      users,                     // ⚠️ all users with PII
      posts,
    });
  }

  if (action === "users") {
    return NextResponse.json({ users }); // VULN-035
  }

  if (action === "resetPasswords") {
    // VULN-053: No CSRF token + resets ALL users to same password
    users.forEach((u) => { u.password = "21232f297a57a5a743894a0e4a801fc3"; }); // MD5("admin")
    return NextResponse.json({ message: "All passwords reset to 'admin'" });
  }

  // VULN-054: Backdoor endpoint
  if (action === "backdoor") {
    return NextResponse.json({
      message: "Backdoor access granted",
      allUsers: users,
      adminApiKey: users.find((u) => u.isAdmin)?.apiKey,
    });
  }

  return NextResponse.json({ actions: ["debug", "users", "resetPasswords", "backdoor"] });
}
