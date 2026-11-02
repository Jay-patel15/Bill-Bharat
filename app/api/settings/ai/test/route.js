import { fail, ok, readBody, withUser } from "@/lib/api";
import { testApiKey } from "@/services/ai/gemini_service";

export async function POST(req) {
  return withUser(async () => {
    try {
      const key = String((await readBody(req))?.apiKey || "").trim() || undefined;
      const reply = await testApiKey(key);
      return ok({ valid: true, message: "Connection verified! Gemini AI OCR is ready to scan invoices.", sampleResponse: reply });
    } catch (e) {
      return fail(e.message || "Failed to connect to Google Gemini API.", 400);
    }
  });
}
