import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url param required" }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "InternalChecker/1.0",
      },
    });

    const text = await response.text();

    return NextResponse.json({
      url,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: text,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err), stack: (err as Error).stack }, { status: 500 });
  }
}
