import fs from "node:fs";
import path from "node:path";
import { withUser } from "@/lib/api";
import { snapshot } from "@/lib/db/sqlite";

export const runtime = "nodejs";

/** One-click backup: a consistent copy of the whole database, downloaded as one file. */
export async function GET() {
  return withUser(async () => {
    const file = snapshot(undefined, "manual");
    return new Response(fs.readFileSync(file), {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="BillBharat-${path.basename(file)}"`
      }
    });
  });
}
