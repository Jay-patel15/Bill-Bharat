import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, ok, readBody } from "@/lib/api";
import { findOne, update } from "@/lib/db";

const Schema = z.object({
  email: z.string().email(),
  code: z.string().trim().min(1, "Recovery code is required"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

/** Reset with the recovery code shown at signup. No code, no reset. */
export async function POST(req) {
  const parse = Schema.safeParse(await readBody(req));
  if (!parse.success) return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
  const { email, code, password } = parse.data;

  const user = await findOne("users", { email: email.toLowerCase() });
  const valid = user?.resetToken && await bcrypt.compare(code.toUpperCase(), user.resetToken);
  if (!valid) return fail("Email or recovery code is wrong", 400);

  await update("users", user.id, { passwordHash: await bcrypt.hash(password, 10) });
  return ok({ reset: true });
}
