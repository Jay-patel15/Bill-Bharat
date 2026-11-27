/**
 * Invoice print template: what the GST invoice PDF shows and what it calls
 * each part. Saved per company as JSON (app_settings "invoice_template:<id>");
 * anything missing falls back to DEFAULT_TEMPLATE, so old saves keep working
 * when new options are added. Shared by the PDF, the API and the editor.
 */

export const DEFAULT_TEMPLATE = {
  show: {
    logo: true, gstin: true, pan: true, stateCode: true, contacts: true,
    reverseCharge: true, copies: true,
    challan: true, order: true, transporter: true, lr: true, eway: true, payment: true, dueDate: true,
    consignee: true,
    hsn: true, unit: true, disc: true,
    bank: true, declaration: true, terms: true, receiverSign: true
  },
  // Default wording follows the standard industrial GST invoice (Rule 46 layout).
  labels: {
    regdOff: "REGD.OFF.:",
    notice: "(Supply of goods under rule 46 of CGST rules,2017 read with section 31 of the CGST Act,2017)",
    invoiceNo: "Invoice No.", invoiceDate: "Invoice Dt.",
    challan: "Challan No.", challanDate: "Challan Dt.",
    order: "Order No.", orderDate: "Order Dt.",
    transporter: "Transporter", lr: "LR.NO.", lrDate: "LR.DT.",
    eway: "Eway No.", payment: "PAYMENT", dueDate: "DUE ON",
    buyer: "Name Of Receiver/Buyer", consignee: "Name Of Consignee/Ship To",
    sr: "Sr", item: "ITEM DESCRIPTION", hsn: "HSN", qty: "QUANTITY", rate: "RATE", unit: "UNIT", disc: "DISC%", amount: "AMOUNT",
    bank: "Our Bank", receiverSign: "Receiver's Sign.", authSign: "Auth.Sign."
  },
  // Terms & conditions are not here: they are the company's own terms (Settings → Terms & Conditions).
  text: {
    numberFormat: "{PREFIX}/{FY}/{####}", // same as DEFAULT_NUMBER_FORMAT in lib/utils.js
    tagline: "",
    reverseCharge: "No",
    declaration: "We declare that this invoice shows the actual price of the goods described and that all particulars are true & correct.",
    quoteNote: "Prices are subject to change with market prices." // quotations only
  }
};

/** Editor layout: which toggle goes with which label, grouped as on the page. */
export const TEMPLATE_SECTIONS = [
  { title: "Header", rows: [
    { show: "logo", name: "Logo" },
    { label: "regdOff", name: "Address prefix" },
    { show: "contacts", name: "Phone / email" },
    { show: "gstin", name: "GSTIN" }, { show: "pan", name: "PAN" }, { show: "stateCode", name: "State code" }
  ] },
  { title: "Title bar", rows: [
    { label: "notice", name: "Rule 46 notice" },
    { show: "reverseCharge", name: "Reverse charge" },
    { show: "copies", name: "Original / Duplicate / Triplicate boxes" }
  ] },
  { title: "Dispatch details", rows: [
    { label: "invoiceNo", name: "Invoice no." }, { label: "invoiceDate", name: "Invoice date" },
    { show: "challan", label: "challan", name: "Challan no. & date" },
    { show: "order", label: "order", name: "Order no. & date" },
    { show: "transporter", label: "transporter", name: "Transporter" },
    { show: "lr", label: "lr", name: "L.R. no. & date" },
    { show: "eway", label: "eway", name: "E-Way bill" },
    { show: "payment", label: "payment", name: "Payment terms" },
    { show: "dueDate", label: "dueDate", name: "Due date" }
  ] },
  { title: "Parties", rows: [
    { label: "buyer", name: "Buyer block" },
    { show: "consignee", label: "consignee", name: "Consignee / Ship-to block" }
  ] },
  { title: "Item columns", rows: [
    { label: "sr", name: "Sr." }, { label: "item", name: "Description" },
    { show: "hsn", label: "hsn", name: "HSN" }, { label: "qty", name: "Quantity" }, { label: "rate", name: "Rate" },
    { show: "unit", label: "unit", name: "Unit" }, { show: "disc", label: "disc", name: "Discount %" }, { label: "amount", name: "Amount" }
  ] },
  { title: "Footer", rows: [
    { show: "bank", label: "bank", name: "Bank details" },
    { show: "declaration", name: "Declaration" },
    { show: "terms", name: "Terms & conditions" },
    { show: "receiverSign", label: "receiverSign", name: "Receiver's signature" },
    { label: "authSign", name: "Authorised signatory" }
  ] }
];

const LIMIT = { tagline: 300, declaration: 600, quoteNote: 300, numberFormat: 60, label: 160 };

/** Defaults + saved values, keeping only known keys of the right type (input from disk or the API). */
export function mergeTemplate(saved) {
  const src = saved && typeof saved === "object" ? saved : {};
  const out = { show: {}, labels: {}, text: {} };
  for (const k of Object.keys(DEFAULT_TEMPLATE.show)) {
    out.show[k] = typeof src.show?.[k] === "boolean" ? src.show[k] : DEFAULT_TEMPLATE.show[k];
  }
  for (const k of Object.keys(DEFAULT_TEMPLATE.labels)) {
    const v = src.labels?.[k];
    out.labels[k] = typeof v === "string" ? v.slice(0, LIMIT.label) : DEFAULT_TEMPLATE.labels[k];
  }
  for (const k of Object.keys(DEFAULT_TEMPLATE.text)) {
    const v = src.text?.[k];
    out.text[k] = typeof v === "string" ? v.slice(0, LIMIT[k] || LIMIT.label) : DEFAULT_TEMPLATE.text[k];
  }
  if (!["Yes", "No"].includes(out.text.reverseCharge)) out.text.reverseCharge = "No";
  // Blank, or the old monthly default saved by earlier versions: use the financial-year default.
  if (!out.text.numberFormat.trim() || out.text.numberFormat === "{PREFIX}-{YYYY}{MM}-{####}") out.text.numberFormat = DEFAULT_TEMPLATE.text.numberFormat;
  return out;
}

export const templateKey = (companyId) => `invoice_template:${companyId}`;
/** Quotations have their own saved style; the terms and bank details still come from the company. */
export const quotationTemplateKey = (companyId) => `quotation_template:${companyId}`;
/** The saved template a document type prints with. */
export const templateKeyFor = (documentType, companyId) =>
  documentType === "Quotation" ? quotationTemplateKey(companyId) : templateKey(companyId);
