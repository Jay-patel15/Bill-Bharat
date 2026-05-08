import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, ok, readBody } from "@/lib/api";
import { signSession, setSessionCookie } from "@/lib/auth";
import { findOne, insert } from "@/lib/google/sheets";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1)
});

export async function POST(req) {
  const body = await readBody(req);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

  const { email, password, name } = parsed.data;
  const existing = await findOne("users", (u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) return fail("Email already registered", 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await insert("users", {
    email: email.toLowerCase(),
    passwordHash,
    name,
    role: "admin"
  });

  const token = await signSession({
    sub: user.id, email: user.email, name: user.name, role: user.role
  });
  await setSessionCookie(token);
  return ok({ id: user.id, email: user.email, name: user.name });
}
