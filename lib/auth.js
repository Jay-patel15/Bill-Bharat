import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = process.env.SESSION_COOKIE_NAME?.trim() || "bb_session";
const ALG = "HS256";

function getKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret?.trim()) throw new Error("JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload, ttl = "7d") {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(getKey());
}

export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, getKey());
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token) {
  if (!token || !token.trim()) return;
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearSessionCookie() {
  cookies().set(COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
}

export async function getCurrentUser() {
  if (process.env.DEV_BYPASS_AUTH === "1") {
    return { id: "dev-user", email: "dev@local", name: "Dev User", role: "admin" };
  }
  const token = cookies().get(COOKIE)?.value;
  if (!token || !token.trim()) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role || "user"
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const err = new Error("UNAUTHORIZED");
    err.status = 401;
    throw err;
  }
  return user;
}
