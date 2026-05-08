import { fail, ok, withUser } from "@/lib/api";
import { uploadFile } from "@/lib/google/drive";

export const runtime = "nodejs";

export async function POST(req) {
  return withUser(async () => {
    try {
      const formData = await req.formData();
      const file = formData.get("file");
      const subfolder = (formData.get("subfolder") || "files").toString();
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
