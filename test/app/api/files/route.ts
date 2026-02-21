import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "public");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("file") || "";

  const filePath = path.join(DATA_DIR, filename);

  if (!filename) {
    const files = fs.readdirSync(DATA_DIR);
    return NextResponse.json({ files });
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json({ file: filename, content });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err), stack: (err as Error).stack }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { filename, content } = await req.json();

  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, content);

  return NextResponse.json({ written: filePath });
}
