import { NextRequest, NextResponse } from "next/server";
import { users, posts } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const type = searchParams.get("type") || "users";

  const simulatedQuery = `SELECT * FROM ${type} WHERE username LIKE '%${q}%'`;
  console.log("[SEARCH QUERY]", simulatedQuery);

  let results: unknown[] = [];

  if (type === "users") {
    results = users.filter(
      (u) =>
        u.username.includes(q) ||
        u.email.includes(q) ||
        (u.ssn || "").includes(q)
    );
  } else if (type === "posts") {
    results = posts.filter(
      (p) => p.title.includes(q) || p.content.includes(q)
    );
  } else {
    results = [];
  }

  return NextResponse.json({
    query: q,
    type,
    simulatedSQL: simulatedQuery,
    count: results.length,
    results,
  });
}
