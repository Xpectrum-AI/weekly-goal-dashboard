import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ───────────────────────────────────────────────────────────────────────────
// Next.js Middleware — route protection.
//
// Simple cookie-presence check that redirects unauthenticated users straight to
// PropelAuth's hosted login. Full JWT verification happens in API route
// handlers (requireAuth).
//
// Public routes (no auth required):
//   /api/auth/* (PropelAuth handler routes)
//   /_next/* (Next.js internals)
//   /favicon.ico, /robots.txt, etc.
// ───────────────────────────────────────────────────────────────────────────

const PUBLIC_PATHS = ["/api/auth"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through without any check
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for PropelAuth access token or refresh token cookie
  const hasToken =
    request.cookies.get("__pa_at")?.value ||
    request.cookies.get("__pa_rt")?.value;

  if (!hasToken) {
    // No token — send straight to PropelAuth's hosted login, returning the user
    // to the page they tried to reach once authenticated.
    const loginUrl = new URL("/api/auth/login", request.url);
    loginUrl.searchParams.set("return_to_path", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Token exists — let the request proceed
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
