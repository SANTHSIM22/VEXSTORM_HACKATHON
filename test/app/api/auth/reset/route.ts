// ⚠️ VULNERABILITY: Password Reset with Predictable Tokens + No Expiry
// VULN-011: Predictable sequential reset token
// VULN-055: Token never expires
// VULN-056: No account lockout after too many reset attempts
// VULN-057: Username enumeration via different error messages

import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/db";
import { generateResetToken, hashPassword } from "@/lib/auth";

// In-memory token store (no expiry)
const resetTokens = new Map<string, number>(); // token → userId

export async function POST(req: NextRequest) {
  const { username, token, newPassword } = await req.json();

  // ── Step 1: Request reset ──
  if (username && !token) {
    const user = users.find((u) => u.username === username);

    if (!user) {
      // VULN-057: Different message when user not found → enumeration
      return NextResponse.json({ error: "Username not found" }, { status: 404 });
    }

    // VULN-011: Predictable token
    const resetToken = generateResetToken();
    resetTokens.set(resetToken, user.id);
    // VULN-055: No expiry set

    // ⚠️ In prod this would be emailed — here it's returned directly
    return NextResponse.json({
      message: "Reset token generated",
      resetToken,  // VULN-058: Token returned in API response body
      userId: user.id,
    });
  }

  // ── Step 2: Use token to reset password ──
  if (token && newPassword) {
    const userId = resetTokens.get(token);

    if (!userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
      // VULN-056: No lockout after failed attempts
    }

    const user = users.find((u) => u.id === userId);
    if (user) {
      // VULN-020: No password strength requirements
      user.password = hashPassword(newPassword);
      resetTokens.delete(token);
    }

    return NextResponse.json({ message: "Password reset successful" });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
