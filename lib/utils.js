import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(d) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date)) return d;
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" });
}

export function formatINR(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}

export function diffDays(d1, d2 = new Date()) {
  if (!d1) return 0;
  const t1 = typeof d1 === "string" ? new Date(d1) : d1;
  const t2 = typeof d2 === "string" ? new Date(d2) : d2;
  if (isNaN(t1) || isNaN(t2)) return 0;
  
  // Set both to midnight to count full days
  t1.setHours(0, 0, 0, 0);
  t2.setHours(0, 0, 0, 0);
  
  const diffTime = Math.abs(t2 - t1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Fuzzy match for type-ahead search. Every word of the query must appear in
 * order (letters may be spread out, "tmt12" finds "TMT Bar 12mm"). Higher is
 * better: exact > prefix > contains > scattered. 0 means no match.
 */
export function fuzzyScore(query, text) {
  const q = String(query || "").toLowerCase().trim();
  const t = String(text || "").toLowerCase();
  if (!q) return 1;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  let pos = 0;
  for (const word of q.split(/\s+/)) {
    for (const ch of word) {
      pos = t.indexOf(ch, pos);
      if (pos === -1) return 0;
      pos++;
    }
  }
  return 20;
}

/** How money moves; each is its own cash/bank ledger. */
export const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque"];

/** Today as YYYY-MM-DD on the machine's clock (toISOString is UTC: wrong before 05:30 IST). */
export function localDate(d = new Date()) {
  return d.toLocaleDateString("en-CA");
}

/** Generate next invoice number like INV-202604-0007 */
// Indian financial year series (April–March): INV/26-27/0001, restarting at 0001 every 1 April.
export const DEFAULT_NUMBER_FORMAT = "{PREFIX}/{FY}/{####}";

/**
 * Next document number for a format such as "{PREFIX}/{FY}/{####}".
 * Tokens: {PREFIX} (INV, PO…), {YYYY}, {YY}, {MM}, {DD}, {FY} (Indian financial
 * year, e.g. 26-27) and {###…} (counter, zero-padded to the number of #).
 * The counter restarts whenever the rest of the number changes, so {MM} gives
 * a monthly series, {FY} a yearly one, and no date token a running one.
 */
export function nextInvoiceNumber(existingNumbers, prefix = "INV", format = DEFAULT_NUMBER_FORMAT, date = localDate()) {
  const [y, mo, d] = String(date || localDate()).slice(0, 10).split("-");
  const fy = Number(mo) >= 4 ? Number(y) : Number(y) - 1;
  const fmt = /\{#+\}/.test(format || "") ? format : `${format || "{PREFIX}"}-{####}`; // no counter: append one
  const fill = (s) => s
    .replace(/\{PREFIX\}/g, prefix).replace(/\{YYYY\}/g, y).replace(/\{YY\}/g, y.slice(2))
    .replace(/\{MM\}/g, mo).replace(/\{DD\}/g, d)
    .replace(/\{FY\}/g, `${String(fy).slice(2)}-${String(fy + 1).slice(2)}`);
  const [, before, hashes, after] = fmt.match(/^(.*?)\{(#+)\}(.*)$/);
  const head = fill(before), tail = fill(after.replace(/\{#+\}/g, ""));
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${esc(head)}(\\d+)${esc(tail)}$`);
  const max = existingNumbers.reduce((m, n) => {
    const hit = re.exec(n || "");
    return hit && Number(hit[1]) > m ? Number(hit[1]) : m;
  }, 0);
  return `${head}${String(max + 1).padStart(hashes.length, "0")}${tail}`;
}

/** Status a quotation can be set to by hand. "Converted" is set only when it becomes an invoice. */
export const QUOTE_STATUSES = ["Draft", "Sent", "Accepted"];

export const DOCUMENT_TYPES = [
  { value: "Tax Invoice",       prefix: "INV", taxable: true,  affectsStock: true,  affectsOutstanding: true,  pdfTitle: "TAX INVOICE" },
  { value: "Proforma Invoice",  prefix: "PI",  taxable: true,  affectsStock: false, affectsOutstanding: false, pdfTitle: "PROFORMA INVOICE" },
  { value: "Purchase Order",    prefix: "PO",  taxable: true,  affectsStock: false, affectsOutstanding: false, pdfTitle: "PURCHASE ORDER" },
  { value: "Delivery Challan",  prefix: "DC",  taxable: false, affectsStock: true,  affectsOutstanding: false, pdfTitle: "DELIVERY CHALLAN" },
  { value: "Quotation",         prefix: "QT",  taxable: true,  affectsStock: false, affectsOutstanding: false, pdfTitle: "QUOTATION" }
];

export function getDocumentType(value) {
  return DOCUMENT_TYPES.find((t) => t.value === value) || DOCUMENT_TYPES[0];
}

export const STATES = [
  ["01", "Jammu and Kashmir"], ["02", "Himachal Pradesh"], ["03", "Punjab"],
  ["04", "Chandigarh"], ["05", "Uttarakhand"], ["06", "Haryana"], ["07", "Delhi"],
  ["08", "Rajasthan"], ["09", "Uttar Pradesh"], ["10", "Bihar"], ["11", "Sikkim"],
  ["12", "Arunachal Pradesh"], ["13", "Nagaland"], ["14", "Manipur"],
  ["15", "Mizoram"], ["16", "Tripura"], ["17", "Meghalaya"], ["18", "Assam"],
  ["19", "West Bengal"], ["20", "Jharkhand"], ["21", "Odisha"],
  ["22", "Chhattisgarh"], ["23", "Madhya Pradesh"], ["24", "Gujarat"],
  ["25", "Daman and Diu"], ["26", "Dadra and Nagar Haveli"], ["27", "Maharashtra"],
  ["28", "Andhra Pradesh (Old)"], ["29", "Karnataka"], ["30", "Goa"],
  ["31", "Lakshadweep"], ["32", "Kerala"], ["33", "Tamil Nadu"],
  ["34", "Puducherry"], ["35", "Andaman and Nicobar"], ["36", "Telangana"],
  ["37", "Andhra Pradesh"], ["38", "Ladakh"]
];

/** Parse notes field to extract any JSON-serialized metadata */
export function parseInvoiceNotes(notesStr) {
  if (!notesStr) return { notes: "", metadata: {} };
  let current = notesStr;
  let metadata = {};
  while (typeof current === "string" && current.startsWith("JSON_METADATA:")) {
    try {
      const data = JSON.parse(current.substring("JSON_METADATA:".length));
      current = data.notes || "";
      if (data.metadata) {
        metadata = { ...metadata, ...data.metadata };
      }
    } catch (e) {
      break;
    }
  }
  return {
    notes: current || "",
    metadata
  };
}

/** Serialize plain notes and metadata into a notes string */
export function formatInvoiceNotes(notesText, metadata) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return notesText || "";
  }
  return "JSON_METADATA:" + JSON.stringify({
    notes: notesText || "",
    metadata
  });
}

