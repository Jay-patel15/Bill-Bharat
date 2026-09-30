import fs from "node:fs";
import { fail, withUser } from "@/lib/api";
import { resolveStoragePath } from "@/lib/storage/local";

export const runtime = "nodejs";

// Enough to cover what the app actually stores: invoice PDFs, company logos,
// and spreadsheet exports. Anything else downloads as a binary blob.
const CONTENT_TYPES = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  csv: "text/csv",
  json: "application/json",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

export async function GET(req, { params }) {
  return withUser(async () => {
    try {
      const id = (params.path || []).join("/");
      if (!id) return fail("file required", 400);

      const filePath = resolveStoragePath(id);
      const data = await fs.promises.readFile(filePath);
      const ext = id.split(".").pop()?.toLowerCase() || "";

      return new Response(data, {
        headers: {
          "content-type": CONTENT_TYPES[ext] || "application/octet-stream",
          "content-disposition": `inline; filename="${id.split("/").pop()}"`,
          // Local file, immutable once written (name carries a timestamp).
          "cache-control": "private, max-age=31536000, immutable"
        }
      });
    } catch (e) {
      if (e.code === "ENOENT") return fail("Not found", 404);
      return fail(e.message || "read failed", 400);
    }
  });
}
