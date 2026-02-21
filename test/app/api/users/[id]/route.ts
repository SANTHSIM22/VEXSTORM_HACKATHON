import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = users.find((u) => u.id === Number(id));
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(user);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.split(" ")[1];
  const caller = getUserFromToken(token || "");

  if (!caller) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const idx = users.findIndex((u) => u.id === Number(id));
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  users[idx] = { ...users[idx], ...body };

  return NextResponse.json(users[idx]);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.split(" ")[1];
  const caller = getUserFromToken(token || "");

  if (!caller) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const idx = users.findIndex((u) => u.id === Number(id));
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  users.splice(idx, 1);
  return NextResponse.json({ deleted: id });
}
