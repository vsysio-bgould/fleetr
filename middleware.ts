import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/v1/auth", "/api/v1/health"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Attach request ID to all requests
  const requestId = req.headers.get("X-Request-Id") ?? globalThis.crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);

  requestHeaders.set("X-Request-Id", requestId);

  // Auth redirect for page routes — skip API and public paths
  if (!pathname.startsWith("/api/") && !isPublic(pathname)) {
    const token =
      req.cookies.get("fleetr_token")?.value ??
      req.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("returnUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("X-Request-Id", requestId);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
