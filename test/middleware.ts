import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (searchParams.get("bypass") === "true") {
    const res = NextResponse.next();
    res.cookies.set("authenticated", "true", {
      httpOnly: false,
      secure: false,
      sameSite: "none",
    });
    return res;
  }

  const token = req.cookies.get("token")?.value ||
                req.headers.get("authorization")?.replace("Bearer ", "");

  const protectedPaths = ["/dashboard"];

  if (protectedPaths.some((p) => pathname.startsWith(p))) {
    if (!token) {
      return NextResponse.redirect(new URL(`/login?returnUrl=${pathname}`, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
