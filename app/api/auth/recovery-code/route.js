import bcrypt from "bcryptjs";
import { fail, ok, withUser } from "@/lib/api";
import { recoveryCode } from "@/lib/auth";
import { update } from "@/lib/db";

/** New recovery code for the signed-in owner. The old code stops working; the new one is shown once. */
export async function POST() {
  return withUser(async (user) => {
    try {
      const code = recoveryCode();
      await update("users", user.id, { resetToken: await bcrypt.hash(code, 10) });
      return ok({ recoveryCode: code });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
