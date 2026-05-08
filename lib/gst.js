/**
 * Indian GST utilities.
 *
 * Rules:
 *  - If supplier and recipient are in the same state -> CGST + SGST (split equally).
 *  - Otherwise (interstate) -> IGST (full rate).
 *  - Common slabs: 0, 5, 12, 18, 28.
 *  - State code is the 2-digit GSTIN prefix (e.g. 27 = Maharashtra, 29 = Karnataka).
 */

export const GST_SLABS = [0, 5, 12, 18, 28];

export function isInterstate(supplierStateCode, recipientStateCode) {
  if (!supplierStateCode || !recipientStateCode) return false;
  return String(supplierStateCode).trim() !== String(recipientStateCode).trim();
}

export function gstStateFromGstin(gstin) {
  if (!gstin || gstin.length < 2) return "";
  return gstin.substring(0, 2);
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Compute totals for a single line item.
 * @param {Object} item - { quantity, sellingPrice, gstRate, discount }
 * @param {boolean} interstate
 */
export function computeLine(item, interstate) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.sellingPrice ?? item.price) || 0;
  const discount = Number(item.discount) || 0;
  const rate = Number(item.gstRate) || 0;

  const gross = qty * price;
  const taxable = Math.max(0, gross - discount);
  const taxAmt = (taxable * rate) / 100;

  let cgst = 0, sgst = 0, igst = 0;
  if (interstate) {
    igst = taxAmt;
  } else {
    cgst = taxAmt / 2;
    sgst = taxAmt / 2;
  }
  const total = taxable + taxAmt;
  return {
    ...item,
    quantity: qty,
    sellingPrice: price,
    gstRate: rate,
    discount,
    taxable: round2(taxable),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    total: round2(total)
  };
}

/**
 * Compute totals for an invoice.
 * @param {Object} opts
 * @param {Array} opts.items
 * @param {string} opts.supplierStateCode
 * @param {string} opts.recipientStateCode
 * @param {number} [opts.invoiceDiscount] flat discount on top of line discounts
 */
export function computeInvoice({ items, supplierStateCode, recipientStateCode, invoiceDiscount = 0 }) {
  const interstate = isInterstate(supplierStateCode, recipientStateCode);
  const computedItems = items.map((it) => computeLine(it, interstate));

  let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
  for (const it of computedItems) {
    subtotal += it.taxable;
    cgst += it.cgst;
    sgst += it.sgst;
    igst += it.igst;
  }
  const grandBeforeRound = subtotal + cgst + sgst + igst - Number(invoiceDiscount || 0);
  const grandTotal = round2(grandBeforeRound);
  const roundOff = round2(grandTotal - grandBeforeRound);

  return {
    interstate,
    items: computedItems,
    subtotal: round2(subtotal),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    invoiceDiscount: round2(invoiceDiscount || 0),
    roundOff,
    grandTotal
  };
}

/**
 * Format INR currency.
 */
export function formatINR(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  });
}

/**
 * Convert a number to Indian-style words (used in invoices).
 */
export function numberToWords(num) {
  num = Math.round(Number(num) || 0);
  if (num === 0) return "Zero Rupees Only";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function inWords(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + inWords(n % 100) : "");
    return "";
  }
  let n = num;
  let parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const rest = n;
  if (crore) parts.push(inWords(crore) + " Crore");
  if (lakh) parts.push(inWords(lakh) + " Lakh");
  if (thousand) parts.push(inWords(thousand) + " Thousand");
  if (rest) parts.push(inWords(rest));
  return parts.join(" ") + " Rupees Only";
}
