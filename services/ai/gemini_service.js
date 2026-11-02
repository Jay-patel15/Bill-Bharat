/**
 * services/ai/gemini_service.js — the only code in BillBharat that talks to
 * the internet, and only when the user asks it to read a bill.
 *
 * - The Gemini API key is entered by the user in Settings and stored in the
 *   local database encrypted (AES-256-GCM) with this install's own secret,
 *   so a copied backup file does not expose it.
 * - No key or no internet: callers get a clear AiUnavailable error and the
 *   manual entry screens keep working.
 */
import crypto from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSetting, setSetting, deleteSetting } from "@/lib/db";

const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
const SETTING = "gemini_api_key";
const TIMEOUT_MS = 45000;

export class AiUnavailable extends Error {
  constructor(message) { super(message); this.status = 503; }
}

// --- key storage -----------------------------------------------------------

function vaultKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret?.trim()) throw new Error("JWT_SECRET not set");
  return crypto.createHash("sha256").update(`gemini-key:${secret}`).digest();
}

function seal(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", vaultKey(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${Buffer.concat([iv, c.getAuthTag(), data]).toString("base64")}`;
}

function open(sealed) {
  if (!sealed?.startsWith("v1:")) return ""; // plain value from an older build: ask again
  try {
    const raw = Buffer.from(sealed.slice(3), "base64");
    const d = crypto.createDecipheriv("aes-256-gcm", vaultKey(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return ""; // restored on another machine: the key must be entered again
  }
}

export async function getApiKey() {
  return open(await getSetting(SETTING)) || process.env.GEMINI_API_KEY?.trim() || "";
}

export async function saveApiKey(key) {
  await setSetting(SETTING, seal(key.trim()));
}

export async function clearApiKey() {
  await deleteSetting(SETTING);
}

// --- calls -----------------------------------------------------------------

const EXTRACTION_PROMPT = `You are an expert at parsing Indian GST purchase invoices. Read the supplied document text or image and return ONLY valid minified JSON, no commentary, matching this schema:

{
  "supplierName": string,
  "supplierGst": string,
  "billNumber": string,
  "billDate": "YYYY-MM-DD",
  "items": [
    {
      "name": string,
      "hsnCode": string,
      "quantity": number,
      "unit": string,
      "purchasePrice": number,
      "gstRate": number,
      "discount": number
    }
  ],
  "subtotal": number,
  "cgst": number,
  "sgst": number,
  "igst": number,
  "total": number
}

Rules:
- gstRate must be a number like 5, 12, 18, 28 (no % sign).
- purchasePrice is the unit rate before tax.
- If a field is missing in the document, use empty string for strings, 0 for numbers, [] for arrays.
- Convert dates to ISO YYYY-MM-DD.
- Do not invent data; only return what you can read.`;

async function generate(parts, apiKey) {
  const key = apiKey || (await getApiKey());
  if (!key) throw new AiUnavailable("AI bill reading is off. Add your Gemini API key in Settings → Gemini AI OCR, or enter the bill by hand.");

  const model = new GoogleGenerativeAI(key).getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: "application/json", temperature: 0 }
  });
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new AiUnavailable("Gemini did not answer in time. Check the internet connection, or enter the bill by hand.")), TIMEOUT_MS);
  });
  try {
    const result = await Promise.race([model.generateContent(parts), timeout]);
    return result.response.text();
  } catch (e) {
    if (e instanceof AiUnavailable) throw e;
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN/.test(e.message || "")) {
      throw new AiUnavailable("No internet connection. AI reading needs internet; manual entry works offline.");
    }
    if (/API_KEY_INVALID|API key not valid/.test(e.message || "")) {
      throw new AiUnavailable("The Gemini API key was rejected. Check it in Settings → Gemini AI OCR.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function readDocument(prompt, fileBuffer, mimeType) {
  const text = await generate([
    { text: prompt },
    { inlineData: { mimeType: mimeType || "application/pdf", data: fileBuffer.toString("base64") } }
  ]);
  return safeParseJson(text);
}

/** Purchase bill → fields for review. Nothing is posted until the user saves. */
export const parsePurchasePdf = (buf, mimeType) => readDocument(EXTRACTION_PROMPT, buf, mimeType);

/** Cheap round trip to prove a key works. */
export async function testApiKey(key) {
  return (await generate([{ text: "Reply with only: OK" }], key)).slice(0, 50);
}

function safeParseJson(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  throw new Error("AI returned non-JSON response");
}
