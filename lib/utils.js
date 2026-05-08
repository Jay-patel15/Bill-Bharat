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

/** Generate next invoice number like INV-202604-0007 */
export function nextInvoiceNumber(existingNumbers, prefix = "INV") {
  const ym = new Date().toISOString().slice(0, 7).replace("-", "");
  const sameMonth = existingNumbers.filter((n) => n && n.startsWith(`${prefix}-${ym}`));
  const max = sameMonth.reduce((m, n) => {
    const tail = parseInt(n.split("-").pop(), 10);
    return isFinite(tail) && tail > m ? tail : m;
  }, 0);
  return `${prefix}-${ym}-${String(max + 1).padStart(4, "0")}`;
}

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
