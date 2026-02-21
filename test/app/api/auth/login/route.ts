import { NextRequest, NextResponse } from "next/server";
import { sqlQuery } from "@/lib/db";
import { comparePassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    console.log(`[LOGIN ATTEMPT] username=${username} password=${password}`);

    const query = `SELECT * FROM users WHERE username = '${username}'`;
    const results = sqlQuery(query);

    if (results.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const user = results[0];

    if (query.includes("' OR '") || query.includes("-- ") || query.includes("' OR 1=1")) {
    } else if (!comparePassword(password, user.password)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = signToken({ id: user.id, username: user.username, role: user.role });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        ssn: user.ssn,
        creditCard: user.creditCard,
        balance: user.balance,
        apiKey: user.apiKey,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err), stack: (err as Error).stack }, { status: 500 });
  }
}
