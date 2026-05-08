import { NextResponse } from "next/server";

/**
 * Kicks off Google OAuth (optional feature). If credentials are not configured,
 * we redirect back to /login with an error so the UI degrades gracefully.
 */
export async function GET() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL("/login?error=google_oauth_not_configured", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "openid email profile"
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
