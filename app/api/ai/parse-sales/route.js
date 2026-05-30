import { fail, ok, withUser } from "@/lib/api";
import { parseSalesInvoice } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req) {
  return withUser(async () => {
    try {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file || typeof file === "string") return fail("file required", 400);
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length === 0) return fail("empty file", 400);
      if (buffer.length > 10 * 1024 * 1024) return fail("file too large (max 10MB)", 413);

      const mimeType = file.type || "application/pdf";
      const parsed = await parseSalesInvoice(buffer, mimeType);
      return ok(parsed);
    } catch (e) {
      return fail(e.message || "Failed to parse document", 500);
    }
  });
}
