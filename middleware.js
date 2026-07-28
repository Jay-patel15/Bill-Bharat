import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { checkRateLimit } from "@/lib/rate-limit";

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
  "/api/auth/google",
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

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || "127.0.0.1";

  // Rate Limiting for Auth API Routes (10 requests per minute)
  if (pathname.startsWith("/api/auth/login") ||
      pathname.startsWith("/api/auth/signup") ||
      pathname.startsWith("/api/auth/forgot") ||
      pathname.startsWith("/api/auth/reset")) {
    const rl = checkRateLimit(`auth:${ip}:${pathname}`, 10, 60 * 1000);
    if (!rl.success) {
      return applySecurityHeaders(
        new NextResponse(
          JSON.stringify({ error: "TOO_MANY_REQUESTS", message: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { "content-type": "application/json", "Retry-After": "60" } }
        )
      );
    }
  }

  // Rate Limiting for general API routes (100 requests per minute)
  if (pathname.startsWith("/api/")) {
    const rl = checkRateLimit(`api:${ip}`, 100, 60 * 1000);
    if (!rl.success) {
      return applySecurityHeaders(
        new NextResponse(
          JSON.stringify({ error: "TOO_MANY_REQUESTS", message: "Too many requests." }),
          { status: 429, headers: { "content-type": "application/json", "Retry-After": "60" } }
        )
      );
    }
  }

  if (isPublic(pathname)) {
    return applySecurityHeaders(NextResponse.next());
  }

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return redirectToLogin(req);

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
    return applySecurityHeaders(NextResponse.next());
  } catch {
    return redirectToLogin(req);
  }
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
