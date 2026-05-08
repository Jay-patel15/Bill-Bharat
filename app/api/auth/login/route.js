import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, ok, readBody } from "@/lib/api";
import { signSession, setSessionCookie } from "@/lib/auth";
import { findOne } from "@/lib/google/sheets";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(req) {
  const body = await readBody(req);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return fail("Invalid email or password", 400);

  const { email, password } = parsed.data;
  const user = await findOne("users", (u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user || !user.passwordHash) return fail("Invalid email or password", 401);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return fail("Invalid email or password", 401);

  const token = await signSession({
    sub: user.id, email: user.email, name: user.name, role: user.role || "user"
  });
  await setSessionCookie(token);
  return ok({ id: user.id, email: user.email, name: user.name });
}
