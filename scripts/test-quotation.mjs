// Self-check for quotations: no stock, no ledger, no payments, status rules, edit and conversion.
// Uses a throwaway database in the OS temp folder.
// Run: node scripts/test-quotation.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-quotation-"));
process.env.BILLBHARAT_DATA_DIR = dir;

const { insert, findById, query } = await import("../lib/db.js");
const { checkConsumables, moveStock } = await import("../lib/consumables.js");
const { priceSale, editSale, quoteStatusFor, checkQuoteStatus, quoteToConvert, markConverted } = await import("../lib/sales.js");
const { getDocumentType, QUOTE_STATUSES } = await import("../lib/utils.js");

const user = await insert("users", { id: "u-quote", email: "quote@test.local", role: "user" });
const company = await insert("companies", { userId: user.id, name: "Quote Co", stateCode: "27", gstNumber: "27AAAAA0000A1Z5" });
const customer = await insert("customers", { companyId: company.id, name: "Customer Q", stateCode: "27" });
const cable = await insert("inventory", { companyId: company.id, name: "6 sq mm wire", unit: "MTR", quantity: 40, purchasePrice: 50 });

const stock = async (id) => Number((await findById("inventory", id)).quantity);
const ledgerRows = async (refId) => (await query(`SELECT COUNT(*) AS n FROM ledger_entries WHERE "refId" = $1`, [refId]))[0].n;
const cableLine = (quantity) => ({ inventoryId: cable.id, name: "6 sq mm wire", quantity, sellingPrice: 100, gstRate: 18, unit: "MTR" });

// Store a document the way the app does (the POST route): price it, save it, and issue stock only if the type does.
async function makeDoc(documentType, items, number, status) {
  const docType = getDocumentType(documentType);
  for (const it of items) it.consumablesUsed = await checkConsumables(company.id, it.inventoryId, it.consumablesUsed || []);
  const computed = priceSale({ company, customer, docType, items });
  const doc = await insert("sales", {
    companyId: company.id, customerId: customer.id, documentType: docType.value, invoiceNumber: number,
    invoiceDate: "2026-11-01", items: computed.items, subtotal: computed.subtotal, discount: 0,
    cgst: computed.cgst, sgst: computed.sgst, igst: computed.igst, total: computed.grandTotal,
    amountPaid: 0, status, notes: ""
  });
  if (docType.affectsStock) await moveStock(company.id, computed.items, -1, user.id);
  return doc;
}

// 1. Status rules: a new quotation takes only a hand-set status; anything else starts as Draft.
assert.deepEqual(QUOTE_STATUSES, ["Draft", "Sent", "Accepted"]);
assert.equal(quoteStatusFor("Sent"), "Sent");
assert.equal(quoteStatusFor("Unpaid"), "Draft");
assert.equal(quoteStatusFor(undefined), "Draft");

// 2. A quotation issues no stock and posts no ledger lines.
const quote = await makeDoc("Quotation", [cableLine(3)], "QT/1", "Draft");
assert.equal(await stock(cable.id), 40);
assert.equal(await ledgerRows(quote.id), 0);
assert.equal(quote.amountPaid, 0);

// 3. Status can be set by hand, never to Converted, and never to an unknown value.
assert.equal(checkQuoteStatus(quote, "Sent"), "Sent");
assert.equal(checkQuoteStatus(quote, "Accepted"), "Accepted");
assert.throws(() => checkQuoteStatus(quote, "Converted"), { status: 400 });
assert.throws(() => checkQuoteStatus(quote, "Paid"), { status: 400 });

// 4. A quotation can be revised: lines change, the total follows, stock and ledger still untouched.
const revised = await editSale(user, quote, { items: [cableLine(5)], discount: 0, notes: "" });
assert.equal(revised.total, 590); // 5 m × 100 + 18% GST
assert.equal(revised.documentType, "Quotation");
assert.equal(await stock(cable.id), 40);
assert.equal(await ledgerRows(quote.id), 0);

// 5. Conversion: the invoice takes the stock; the quotation is marked Converted and points at the invoice.
assert.equal((await quoteToConvert(quote.id, company.id)).id, quote.id);
await assert.rejects(quoteToConvert(quote.id, "another-company"), { status: 400 });
const invoice = await makeDoc("Tax Invoice", [cableLine(5)], "INV/1", "Unpaid");
assert.equal(await stock(cable.id), 35);
await markConverted(quote, invoice.id, user.id);
const converted = await findById("sales", quote.id);
assert.equal(converted.status, "Converted");
assert.equal(converted.convertedToId, invoice.id);

// 6. A converted quotation is locked: no second conversion, no edit, no status change.
await assert.rejects(quoteToConvert(quote.id, company.id), { status: 409 });
await assert.rejects(editSale(user, converted, { items: [cableLine(1)], discount: 0, notes: "" }), { status: 400 });
assert.throws(() => checkQuoteStatus(converted, "Draft"), { status: 400 });

// 7. Only quotations convert: an invoice id is refused.
await assert.rejects(quoteToConvert(invoice.id, company.id), { status: 400 });

fs.rmSync(dir, { recursive: true, force: true });
console.log("quotation: all checks passed");
