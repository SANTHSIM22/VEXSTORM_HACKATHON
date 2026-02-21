import { NextRequest, NextResponse } from "next/server";
import { comments } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const postId = searchParams.get("postId");

  const filtered = postId
    ? comments.filter((c) => c.postId === Number(postId))
    : comments;

  return NextResponse.json({ comments: filtered });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const newComment = {
    id: comments.length + 1,
    postId: Number(body.postId) || 0,
    author: body.author || "anonymous",
    content: body.content || "",
  };

  comments.push(newComment);

  return NextResponse.json({ comment: newComment });
}
