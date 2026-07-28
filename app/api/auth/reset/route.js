import bcrypt from "bcryptjs";
import { fail, ok, readBody } from "@/lib/api";
import { findOne, update } from "@/lib/db";
import { authResetSchema } from "@/lib/validations";

export async function POST(req) {
  const body = await readBody(req);
  const parse = authResetSchema.safeParse(body);
  if (!parse.success) {
    return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
  }
  const { token, password } = parse.data;
  const email = (body.email || "").toLowerCase();

  const user = await findOne("users", (u) => u.email?.toLowerCase() === email && u.resetToken === token);
  if (!user || user.resetToken !== token) return fail("Invalid or expired token", 400);
  if (!user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt) < new Date()) {
    return fail("Token expired", 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await update("users", user.id, {
    passwordHash, resetToken: null, resetTokenExpiresAt: null
  });
  return ok({ reset: true });
}
