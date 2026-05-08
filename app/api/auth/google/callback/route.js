import { NextResponse } from "next/server";
import { signSession, setSessionCookie } from "@/lib/auth";
import { findOne, insert, update } from "@/lib/google/sheets";

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=no_code", url.origin));

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
      grant_type: "authorization_code"
    })
  });
  if (!tokenRes.ok) return NextResponse.redirect(new URL("/login?error=token_exchange", url.origin));
  const tokens = await tokenRes.json();

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  const profile = await profileRes.json();
  if (!profile.email) return NextResponse.redirect(new URL("/login?error=no_email", url.origin));

  let user = await findOne("users", (u) => u.email?.toLowerCase() === profile.email.toLowerCase());
  if (!user) {
    user = await insert("users", {
      email: profile.email.toLowerCase(),
      name: profile.name || profile.email,
      googleId: profile.sub,
      role: "admin",
      passwordHash: ""
    });
  } else if (!user.googleId) {
    await update("users", user.id, { googleId: profile.sub });
  }

  const jwt = await signSession({
    sub: user.id, email: user.email, name: user.name, role: user.role || "user"
  });
  await setSessionCookie(jwt);
  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
