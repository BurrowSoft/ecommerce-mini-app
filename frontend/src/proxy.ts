import { NextRequest, NextResponse } from "next/server";

// Next.js 16 renamed middleware.ts -> proxy.ts (exported function middleware -> proxy).
// This only checks whether a session cookie is PRESENT, purely for redirect UX
// (avoids a flash of the catalog page before an API call would 401). It is not
// the security boundary — every catalog/auth-protected backend route validates
// the session for real via SessionAuthGuard and rejects unauthenticated
// requests regardless of what this proxy does.
export function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies.has("connect.sid");
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!hasSessionCookie && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSessionCookie && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
