import { NextResponse, type NextRequest } from "next/server";

/**
 * Passes the request path to server components (for sign-in return links) and sets
 * security headers. Authentication itself is checked server-side against the session table.
 */
export function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-lobby-path", req.nextUrl.pathname + req.nextUrl.search);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/health|icons/|manifest.webmanifest).*)"],
};
