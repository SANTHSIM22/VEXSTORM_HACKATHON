import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/db";
import { getUserFromToken, hashPassword } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.split(" ")[1];

  const caller = getUserFromToken(token || "");
  if (!caller?.isAdmin) {
    return NextResponse.json({ error: "Admins only", existingUserCount: users.length }, { status: 403 });
  }

  const body = await req.json();
  const newUser = {
    id: users.length + 1,
    ...body,
    password: hashPassword(body.password || "changeme"),
  };
  users.push(newUser);

  return NextResponse.json(newUser);
}
