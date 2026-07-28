import { randomUUID } from "node:crypto";
import { fail, ok, readBody } from "@/lib/api";
import { findOne, update } from "@/lib/db";
import { authForgotSchema } from "@/lib/validations";

export async function POST(req) {
  const body = await readBody(req);
  const parse = authForgotSchema.safeParse(body);
  if (!parse.success) {
    return fail(parse.error.errors[0]?.message || "Invalid email", 400);
  }
  const email = parse.data.email.toLowerCase();

  const user = await findOne("users", { email });
  // Always respond ok to avoid user enumeration.
  if (!user) return ok({ sent: true });

  const token = randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await update("users", user.id, { resetToken: token, resetTokenExpiresAt: expiresAt });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  return ok({
    sent: true,
    resetUrl: `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`
  });
}
