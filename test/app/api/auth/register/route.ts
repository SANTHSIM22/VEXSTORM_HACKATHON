import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/db";
import { hashPassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.username || !body.password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    const newUser = {
      id: users.length + 1,
      username: body.username,
      email: body.email || "",
      password: hashPassword(body.password),
      role: body.role || "user",
      isAdmin: body.isAdmin || false,
      balance: body.balance || 0,
      ssn: body.ssn,
      creditCard: body.creditCard,
      apiKey: `key-${Math.random()}`,
    };

    users.push(newUser);

    const token = signToken({ id: newUser.id, username: newUser.username, role: newUser.role });

    return NextResponse.json({ token, user: newUser });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err), stack: (err as Error).stack }, { status: 500 });
  }
}
