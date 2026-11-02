import bcrypt from "bcryptjs";
import { fail, ok, readBody, withUser } from "@/lib/api";
import { eraseAllBooks, findById } from "@/lib/db";
import { snapshot } from "@/lib/db/sqlite";

export const runtime = "nodejs";

/** POST { password }: erase all books after checking the login password. A full backup is taken first, so Restore can undo it. */
export async function POST(req) {
  return withUser(async (user) => {
    try {
      const { password } = await readBody(req);
      const row = await findById("users", user.id);
      if (!password || !row?.passwordHash || !(await bcrypt.compare(String(password), row.passwordHash))) {
        return fail("Wrong password. Nothing was erased.", 401);
      }
      const backup = snapshot(undefined, "before_reset");
      await eraseAllBooks();
      return ok({ erased: true, backup });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
