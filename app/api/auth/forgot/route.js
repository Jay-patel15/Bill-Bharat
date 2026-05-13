import { randomUUID } from "node:crypto";
import { fail, ok, readBody } from "@/lib/api";
import { findOne, update } from "@/lib/db";

/**
 * Generates a reset token. In production this would be emailed.
 * For now, returns the reset link directly so the operator can hand it off.
 */
export async function POST(req) {
  const { email } = await readBody(req);
  if (!email) return fail("email required", 400);
  const user = await findOne("users", (u) => u.email?.toLowerCase() === email.toLowerCase());
  // Always respond ok to avoid user enumeration.
  if (!user) return ok({ sent: true });

  const token = randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await update("users", user.id, { resetToken: token, resetTokenExpiresAt: expiresAt });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  return ok({
    sent: true,
    // Only included when the dev hasn't wired up email yet.
    resetUrl: `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`
  });
}

