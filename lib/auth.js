import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { findById, insert } from "./db";

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
  const token = cookies().get(COOKIE)?.value;
  if (token && token.trim()) {
    const payload = await verifySession(token);
    if (payload && payload.sub) {
      const dbUser = await findById("users", payload.sub);
      if (dbUser) {
        return {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role || "user"
        };
      }
    }
  }

  if (process.env.DEV_BYPASS_AUTH === "1") {
    let devUser = await findById("users", "dev-user-id");
    if (!devUser) {
      try {
        devUser = await insert("users", {
          id: "dev-user-id",
          email: "dev@example.com",
          name: "Developer Admin",
          role: "admin",
          passwordHash: "bypass"
        });
      } catch {
        devUser = await findById("users", "dev-user-id");
      }
    }
    return {
      id: "dev-user-id",
      email: "dev@example.com",
      name: "Developer Admin",
      role: "admin"
    };
  }

  return null;
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
