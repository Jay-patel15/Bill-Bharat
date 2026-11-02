import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fail, ok, withUser } from "@/lib/api";
import { restoreFrom } from "@/lib/db/sqlite";

export const runtime = "nodejs";

/** Replace the books with an uploaded backup. The current books are snapshotted first. */
export async function POST(req) {
  return withUser(async () => {
    const tmp = path.join(os.tmpdir(), `bb-restore-${Date.now()}.db`);
    try {
      const file = (await req.formData()).get("file");
      if (!file || typeof file === "string") return fail("Backup file required", 400);
      fs.writeFileSync(tmp, Buffer.from(await file.arrayBuffer()));
      restoreFrom(tmp);
      return ok({ restored: true });
    } catch (e) {
      return fail(e.message || "Restore failed", 400);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });
}
