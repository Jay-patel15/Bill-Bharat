import { NextResponse } from "next/server";

const COOKIE = process.env.SESSION_COOKIE_NAME || "bb_session";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password"
];

const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/forgot",
  "/api/auth/reset",
  "/api/health"
];

function isPublic(pathname) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return false;
}

function applySecurityHeaders(res) {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-XSS-Protection", "1; mode=block");
  return res;
}

/**
 * Routing guard only: is a session cookie present at all?
 *
 * The signature is NOT verified here on purpose. Middleware runs in the Edge
 * runtime, where Next.js can inline build-time env values — and the packaged
 * app generates its JWT_SECRET at first launch, so a secret baked in at build
 * time would be the wrong one. Real verification happens on every request in
 * getCurrentUser() (lib/auth.js), which every API route reaches through
 * withUser()/requireUser() and every app page through the (app) layout. A
 * forged or expired cookie therefore gets past this redirect and is then
 * rejected server-side.
 */
export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (process.env.DEV_BYPASS_AUTH === "1") {
    if (pathname === "/" || PUBLIC_PATHS.includes(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return applySecurityHeaders(NextResponse.redirect(url));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  if (isPublic(pathname)) return applySecurityHeaders(NextResponse.next());
  if (!req.cookies.get(COOKIE)?.value) return redirectToLogin(req);
  return applySecurityHeaders(NextResponse.next());
}

function redirectToLogin(req) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return applySecurityHeaders(
      new NextResponse(JSON.stringify({ error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { "content-type": "application/json" }
      })
    );
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return applySecurityHeaders(NextResponse.redirect(url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
