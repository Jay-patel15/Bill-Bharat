import { GoogleGenerativeAI } from "@google/generative-ai";

const EXTRACTION_PROMPT = `You are an expert at parsing Indian GST purchase invoices. Read the supplied PDF and return ONLY valid minified JSON, no commentary, matching this schema:

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
- If a field is missing in the PDF, use empty string for strings, 0 for numbers, [] for arrays.
- Convert dates to ISO YYYY-MM-DD.
- Do not invent data; only return what you can read.`;

/**
 * Parse a purchase-invoice PDF using Gemini's multimodal API.
 * @param {Buffer} pdfBuffer
 * @returns {Promise<Object>} parsed JSON
 */
export async function parsePurchasePdf(pdfBuffer) {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", temperature: 0 }
  });

  const result = await model.generateContent([
    { text: EXTRACTION_PROMPT },
    {
      inlineData: {
        mimeType: "application/pdf",
        data: pdfBuffer.toString("base64")
      }
    }
  ]);

  const text = result.response.text();
  return safeParseJson(text);
}

const SALES_EXTRACTION_PROMPT = `You are an expert at parsing Indian GST sales invoices or reference bills. Read the supplied document (PDF or Image) and return ONLY valid minified JSON, no commentary, matching this schema:

{
  "customerName": string,
  "customerGst": string,
  "customerAddress": string,
  "customerPhone": string,
  "customerEmail": string,
  "customerState": string,
  "customerStateCode": string,
  "invoiceNumber": string,
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "items": [
    {
      "name": string,
      "hsnCode": string,
      "quantity": number,
      "unit": string,
      "sellingPrice": number,
      "gstRate": number,
      "discount": number
    }
  ],
  "subtotal": number,
  "cgst": number,
  "sgst": number,
  "igst": number,
  "discount": number,
  "total": number,
  "notes": string
}

Rules:
- customerName is the recipient/buyer of the invoice, NOT the supplier/issuer.
- customerGst is the GSTIN of the recipient/buyer.
- gstRate must be a number like 5, 12, 18, 28 (no % sign).
- sellingPrice is the unit rate before tax.
- If a field is missing in the document, use empty string for strings, 0 for numbers, [] for arrays.
- Convert dates to ISO YYYY-MM-DD.
- Do not invent data; only return what you can read.`;

/**
 * Parse a sales-invoice PDF or Image using Gemini's multimodal API.
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 * @returns {Promise<Object>} parsed JSON
 */
export async function parseSalesInvoice(fileBuffer, mimeType) {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", temperature: 0 }
  });

  const result = await model.generateContent([
    { text: SALES_EXTRACTION_PROMPT },
    {
      inlineData: {
        mimeType: mimeType || "application/pdf",
        data: fileBuffer.toString("base64")
      }
    }
  ]);

  const text = result.response.text();
  return safeParseJson(text);
}

function safeParseJson(text) {
  try { return JSON.parse(text); } catch {}
  // Try to extract first JSON object from text
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  throw new Error("AI returned non-JSON: " + text.slice(0, 200));
}
