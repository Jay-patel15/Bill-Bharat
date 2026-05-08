import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

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

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (process.env.DEV_BYPASS_AUTH === "1") return NextResponse.next();
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return redirectToLogin(req);

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return redirectToLogin(req);
  }
}

function redirectToLogin(req) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
