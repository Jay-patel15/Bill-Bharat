import { GoogleGenerativeAI } from "@google/generative-ai";

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

const SALES_EXTRACTION_PROMPT = `You are an expert at parsing Indian GST sales invoices or reference bills. Read the supplied document text or image and return ONLY valid minified JSON, no commentary, matching this schema:

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

function extractTextFromPdfBuffer(buffer) {
  try {
    const raw = buffer.toString("utf8");
    const matches = [];
    const regex = /\(([^)]+)\)\s*T[jJ]/g;
    let m;
    while ((m = regex.exec(raw)) !== null) {
      if (m[1] && m[1].length > 1) matches.push(m[1]);
    }
    if (matches.length > 5) {
      return matches.join(" ");
    }
    // Clean printable text
    const clean = raw.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
    return clean.slice(0, 8000);
  } catch (e) {
    return "";
  }
}

/**
 * Call OpenRouter API for document parsing.
 */
async function callOpenRouter(promptText, fileBuffer, mimeType) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim() || "openrouter/free";

  const isImage = mimeType && mimeType.startsWith("image/");
  let userMessageContent = [];

  if (isImage) {
    const base64Data = fileBuffer.toString("base64");
    const dataUri = `data:${mimeType};base64,${base64Data}`;
    userMessageContent = [
      { type: "text", text: promptText },
      { type: "image_url", image_url: { url: dataUri } }
    ];
  } else {
    // For PDF or text documents, extract text and send as prompt text
    const pdfText = extractTextFromPdfBuffer(fileBuffer);
    const combinedPrompt = `${promptText}\n\nDocument Text Content:\n${pdfText}`;
    userMessageContent = [
      { type: "text", text: combinedPrompt }
    ];
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://billbharat.app",
      "X-Title": "BillBharat GST Invoicing",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: userMessageContent
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errText}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content || "";
  return safeParseJson(content);
}

/**
 * Call direct Gemini API fallback for native binary PDF/image rendering.
 */
async function callGeminiDirect(promptText, fileBuffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", temperature: 0 }
  });

  const result = await model.generateContent([
    { text: promptText },
    {
      inlineData: {
        mimeType: mimeType || "application/pdf",
        data: fileBuffer.toString("base64")
      }
    }
  ]);

  return safeParseJson(result.response.text());
}

/**
 * Parse a purchase-invoice PDF/Image using OpenRouter or Gemini.
 */
export async function parsePurchasePdf(pdfBuffer, mimeType = "application/pdf") {
  if (process.env.OPENROUTER_API_KEY?.trim()) {
    try {
      const res = await callOpenRouter(EXTRACTION_PROMPT, pdfBuffer, mimeType);
      if (res && ((res.items && res.items.length > 0) || res.supplierName) || !process.env.GEMINI_API_KEY?.trim()) {
        return res;
      }
    } catch (e) {
      if (!process.env.GEMINI_API_KEY?.trim()) throw e;
    }
  }
  if (process.env.GEMINI_API_KEY?.trim()) {
    return await callGeminiDirect(EXTRACTION_PROMPT, pdfBuffer, mimeType);
  }
  throw new Error("Neither OPENROUTER_API_KEY nor GEMINI_API_KEY is configured in .env");
}

export async function parseSalesInvoice(fileBuffer, mimeType = "application/pdf") {
  if (process.env.OPENROUTER_API_KEY?.trim()) {
    try {
      const res = await callOpenRouter(SALES_EXTRACTION_PROMPT, fileBuffer, mimeType);
      if (res && ((res.items && res.items.length > 0) || res.customerName) || !process.env.GEMINI_API_KEY?.trim()) {
        return res;
      }
    } catch (e) {
      if (!process.env.GEMINI_API_KEY?.trim()) throw e;
    }
  }
  if (process.env.GEMINI_API_KEY?.trim()) {
    return await callGeminiDirect(SALES_EXTRACTION_PROMPT, fileBuffer, mimeType);
  }
  throw new Error("Neither OPENROUTER_API_KEY nor GEMINI_API_KEY is configured in .env");
}

function safeParseJson(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  throw new Error("AI returned non-JSON response");
}
