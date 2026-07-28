import { fail, ok, withUser } from "@/lib/api";
import { uploadFile } from "@/lib/storage/supabase";

export const runtime = "nodejs";

export async function POST(req) {
  return withUser(async () => {
    try {
      const formData = await req.formData();
      const file = formData.get("file");
      let subfolder = (formData.get("subfolder") || "files").toString();
      // Sanitize subfolder against path traversal
      subfolder = subfolder.replace(/[^a-zA-Z0-9_-]/g, "");
      if (!subfolder) subfolder = "files";

      if (!file || typeof file === "string") return fail("file required", 400);
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length > 10 * 1024 * 1024) return fail("file too large (max 10MB)", 413);

      const result = await uploadFile({
        data: buffer,
        filename: file.name || `upload-${Date.now()}`,
        mimeType: file.type || "application/octet-stream",
        subfolder
      });
      return ok(result);
    } catch (e) {
      return fail(e.message || "upload failed", 500);
    }
  });
}
