import { fail, ok, readBody, withUser } from "@/lib/api";
import { getApiKey, saveApiKey, clearApiKey } from "@/services/ai/gemini_service";

function maskApiKey(key) {
  if (!key) return "";
  return key.length <= 8 ? "••••••••" : `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export async function GET() {
  return withUser(async () => {
    try {
      const key = await getApiKey();
      return ok({ hasKey: Boolean(key), maskedKey: maskApiKey(key), source: key ? "database" : null });
    } catch (e) {
      return fail(e.message || "Failed to get AI settings", 500);
    }
  });
}

export async function POST(req) {
  return withUser(async () => {
    try {
      const apiKey = String((await readBody(req))?.apiKey || "").trim();
      if (apiKey.length < 10) {
        return fail("Invalid Gemini API key format. Please enter a valid API key from Google AI Studio.", 400);
      }
      await saveApiKey(apiKey);
      return ok({ saved: true, hasKey: true, maskedKey: maskApiKey(apiKey), message: "Gemini API key saved." });
    } catch (e) {
      return fail(e.message || "Failed to save Gemini API key", 500);
    }
  });
}

export async function DELETE() {
  return withUser(async () => {
    try {
      await clearApiKey();
      return ok({ deleted: true, hasKey: false, maskedKey: "", message: "Gemini API key removed." });
    } catch (e) {
      return fail(e.message || "Failed to remove Gemini API key", 500);
    }
  });
}
