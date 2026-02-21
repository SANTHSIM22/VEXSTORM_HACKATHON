// ⚠️ VULNERABILITY: Insecure Direct Object Reference on posts
// VULN-034: No auth check — private posts accessible without login
// VULN-044: Private posts returned to any caller

import { NextRequest, NextResponse } from "next/server";
import { posts, comments } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const post = posts.find((p) => p.id === Number(id));
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // VULN-034 + VULN-044: Private posts returned without auth check
    return NextResponse.json({ post });
  }

  // Return all posts including private ones
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  // VULN-047: No auth check to create posts
  const body = await req.json();

  const newPost = {
    id: posts.length + 1,
    userId: body.userId || 0, // VULN-049: userId not validated against session
    title: body.title || "",
    content: body.content || "", // VULN-048: raw HTML stored
    isPrivate: body.isPrivate || false,
  };

  posts.push(newPost);

  // Also store any embedded comment directly
  if (body.comment) {
    comments.push({ id: comments.length + 1, postId: newPost.id, author: body.author || "anon", content: body.comment });
  }

  return NextResponse.json({ post: newPost });
}
