import bcrypt from "bcryptjs";
import { fail, ok, readBody } from "@/lib/api";
import { findOne, update } from "@/lib/google/sheets";

export async function POST(req) {
  const { email, token, password } = await readBody(req);
  if (!email || !token || !password) return fail("email, token, password required", 400);
  if (password.length < 6) return fail("Password must be at least 6 characters", 400);

  const user = await findOne("users", (u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user || user.resetToken !== token) return fail("Invalid or expired token", 400);
  if (!user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt) < new Date()) {
    return fail("Token expired", 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await update("users", user.id, {
    passwordHash, resetToken: "", resetTokenExpiresAt: ""
  });
  return ok({ reset: true });
}
