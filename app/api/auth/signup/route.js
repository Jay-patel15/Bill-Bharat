import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, ok, readBody } from "@/lib/api";
import { signSession, setSessionCookie } from "@/lib/auth";
import { insert, query } from "@/lib/db";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1)
});

/** 16 chars from an alphabet without look-alikes, shown once as XXXX-XXXX-XXXX-XXXX. */
function recoveryCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const raw = [...randomBytes(16)].map((b) => abc[b % abc.length]).join("");
  return raw.match(/.{4}/g).join("-");
}

export async function POST(req) {
  try {
    const body = await readBody(req);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

    // One owner per install: later visitors can't create themselves an account.
    const [{ n }] = await query(`SELECT COUNT(*) AS n FROM users`);
    if (n > 0) return fail("This computer already has an owner account. Sign in instead.", 403);

    const { email, password, name } = parsed.data;
    const code = recoveryCode();
    const user = await insert("users", {
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
      // The reset token column holds the hashed recovery code; the plain code is shown once.
      resetToken: await bcrypt.hash(code, 10),
      name,
      role: "admin"
    });

    const token = await signSession({ sub: user.id, email: user.email, name: user.name, role: user.role });
    await setSessionCookie(token);
    return ok({ id: user.id, email: user.email, name: user.name, recoveryCode: code });
  } catch (e) {
    console.error("Signup error:", e);
    return fail(e.message, 500);
  }
}
