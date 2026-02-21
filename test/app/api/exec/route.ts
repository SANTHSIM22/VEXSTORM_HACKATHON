import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const host = searchParams.get("host") || "localhost";

  try {
    const { stdout, stderr } = await execAsync(`ping -c 2 ${host}`);

    return NextResponse.json({
      host,
      output: stdout,
      errors: stderr,
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string; stack?: string };
    return NextResponse.json({
      error: e.message,
      stdout: e.stdout,
      stderr: e.stderr,
      stack: e.stack,
    }, { status: 500 });
  }
}
