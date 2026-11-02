import fs from "node:fs";
import path from "node:path";
import { fail, ok, readBody, withUser } from "@/lib/api";
import { backupStatus, dailyBackup, offsiteIdle, setBackupFolders, snapshot } from "@/lib/db/sqlite";

export const runtime = "nodejs";

/** GET: backup status. Also takes today's daily backup if it is still missing (the app shell calls this on open and hourly). */
export async function GET() {
  return withUser(async () => {
    try {
      dailyBackup();
      return ok(backupStatus());
    } catch (e) { return fail(e.message, 500); }
  });
}

/** PUT { folders: [...] }: extra backup folders. Each must be an absolute path the app can write to. */
export async function PUT(req) {
  return withUser(async () => {
    const { folders } = await readBody(req);
    if (!Array.isArray(folders) || folders.length > 5) return fail("Give up to 5 folders", 400);
    const clean = [...new Set(folders.map((f) => String(f || "").trim()).filter(Boolean))];
    for (const dir of clean) {
      if (!path.isAbsolute(dir)) return fail(`"${dir}" is not a full path (e.g. G:\\My Drive\\BillBharat)`, 400);
      try {
        await fs.promises.mkdir(dir, { recursive: true });
        const probe = path.join(dir, `.billbharat-write-test-${Date.now()}`);
        await fs.promises.writeFile(probe, "ok");
        await fs.promises.rm(probe);
      } catch (e) { return fail(`Cannot write to "${dir}" (${e.code || e.message})`, 400); }
    }
    setBackupFolders(clean);
    snapshot(undefined, "manual"); // first copy lands in the new folders straight away
    await offsiteIdle(); // the user is waiting on this button, so report the real copy result
    return ok(backupStatus());
  });
}

/** POST: back up now to the local backups folder and every extra folder. */
export async function POST() {
  return withUser(async () => {
    try {
      snapshot(undefined, "manual");
      await offsiteIdle(); // other requests keep running while this one waits for the copies
      return ok(backupStatus());
    } catch (e) { return fail(e.message, 500); }
  });
}
