import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ENTRY_READY_COOKIE = "ody_entry_ready";

export function middleware(req: NextRequest) {
  const ready = req.cookies.get(ENTRY_READY_COOKIE)?.value === "1";
  if (ready) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("reason", "session_required");
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/game/:path*"]
};
