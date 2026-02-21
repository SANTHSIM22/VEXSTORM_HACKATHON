// ⚠️ VULNERABILITY: Insecure Transfer / Business Logic
// VULN-070: No check that sender has sufficient balance
// VULN-071: Negative transfer amount → reverse transfer (increases own balance)
// VULN-072: No CSRF protection
// VULN-073: Race condition — no atomic operation

import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.split(" ")[1];
  const caller = getUserFromToken(token || "");

  if (!caller) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { toUserId, amount } = await req.json();

  // VULN-071: Negative amount not prevented
  // Payload: { "toUserId": 1, "amount": -10000 } → steals from admin
  const fromUser = users.find((u) => u.id === caller.id);
  const toUser   = users.find((u) => u.id === Number(toUserId));

  if (!toUser) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

  // VULN-070: No balance check
  // VULN-073: Non-atomic — concurrent requests can overdraw
  fromUser!.balance -= amount;
  toUser.balance   += amount;

  return NextResponse.json({
    message: "Transfer complete",
    yourNewBalance: fromUser!.balance,
    // VULN-014: Returns full recipient object
    recipient: toUser,
  });
}
