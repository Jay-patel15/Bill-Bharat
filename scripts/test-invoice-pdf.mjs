// Self-check for the bill PDF: notes printed, Valid till only on quotations, terms with a heading and bullets.
// Run: node scripts/test-invoice-pdf.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { computeInvoice } from "../lib/gst.js";

// lib/pdf.js imports "./gst" without an extension, so load it through jiti (Next's resolver).
const jiti = createRequire(import.meta.url)("jiti")(import.meta.url);
const { generateInvoicePdf } = jiti("../lib/pdf.js");

const company = {
  name: "PDF Check Co", stateCode: "27", gstNumber: "27AAAAA0000A1Z5", address: "1 Road", city: "Pune",
  bankName: "Bank", bankAccountNo: "123", bankIfsc: "BANK0000001",
  termsAndConditions: "Payment within 30 days\n2. Goods once sold will not be taken back\nDelivery is ex-works and the buyer bears the freight charges for the entire consignment"
};
const customer = { name: "Buyer", stateCode: "27", gstNumber: "27BBBBB0000B1Z5" };
const c = computeInvoice({
  items: [{ name: "Cable", quantity: 2, sellingPrice: 100, gstRate: 18, unit: "MTR", hsnCode: "8544" }],
  supplierStateCode: "27", recipientStateCode: "27", invoiceDiscount: 0, roundToRupee: true
});

function render(title, metadata) {
  const pdf = generateInvoicePdf({
    company, customer, title, output: "buffer",
    invoice: {
      invoiceNumber: "QT/1", invoiceDate: "2026-11-27", dueDate: null, items: c.items,
      subtotal: c.subtotal, cgst: c.cgst, sgst: c.sgst, igst: c.igst, invoiceDiscount: 0, grandTotal: c.grandTotal,
      notes: "Prices valid for 15 days", metadata
    }
  });
  assert.ok(Buffer.isBuffer(pdf), "PDF is a buffer");
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  return pdf.toString("latin1");
}

// Quotation: notes, valid till, terms heading and bullets all print.
const quote = render("QUOTATION", { validTill: "2026-12-31" });
assert.ok(quote.includes("Prices valid for 15 days"), "notes are printed");
assert.ok(quote.includes("This quotation is valid till 31/12/2026"), "valid till is printed as a note on a quotation");
assert.ok(quote.includes("Prices are subject to change with market prices."), "market price note printed on a quotation");
assert.ok(quote.includes("TERMS AND CONDITIONS"), "terms have a heading");
assert.ok(quote.includes("Payment within 30 days"), "first term printed");
assert.ok(quote.includes("Goods once sold will not be taken back"), "numbered term printed without its number");
assert.ok(!quote.includes("2. Goods once sold"), "term numbering removed");

// Tax invoice: valid till is never printed, even when the form saved one.
const invoice = render("TAX INVOICE", { validTill: "2026-12-31" });
assert.ok(!invoice.includes("valid till"), "valid till is not printed on a tax invoice");
assert.ok(invoice.includes("Prices valid for 15 days"), "notes are printed on a tax invoice too");
assert.ok(!invoice.includes("Prices are subject to change"), "market price note is quotation-only");

console.log("invoice pdf: all checks passed");
