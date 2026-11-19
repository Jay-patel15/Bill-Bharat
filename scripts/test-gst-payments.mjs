// Self-check: GST only when a GSTIN is given, selling rate copied to stock, and deleting payment entries.
// Uses a throwaway database in the OS temp folder. Run: node scripts/test-gst-payments.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-gst-pay-"));
process.env.BILLBHARAT_DATA_DIR = dir;

const { insert, findById, remove, query } = await import("../lib/db.js");
const { addPayment, recalcPaid } = await import("../lib/accounting.js");
const { priceSale, syncSellingRates } = await import("../lib/sales.js");
const { getDocumentType } = await import("../lib/utils.js");

const user = await insert("users", { id: "u-gst", email: "gst@test.local", role: "user" });
const noGst = await insert("companies", { userId: user.id, name: "Unregistered Shop", stateCode: "27" });
const withGst = await insert("companies", { userId: user.id, name: "Registered Co", stateCode: "27", gstNumber: "27AAAAA0000A1Z5" });
const customer = await insert("customers", { companyId: withGst.id, name: "Buyer", stateCode: "27" });
const taxInvoice = getDocumentType("Tax Invoice");
const line = (over = {}) => ({ name: "Pipe", quantity: 10, sellingPrice: 100, gstRate: 18, discount: 0, ...over });

// 1. Without a GSTIN: no tax, whatever rate the line carries.
const plain = priceSale({ company: noGst, customer, docType: taxInvoice, items: [line()] });
assert.equal(plain.cgst + plain.sgst + plain.igst, 0);
assert.equal(plain.items[0].gstRate, 0);
assert.equal(plain.grandTotal, 1000);

// 2. With a GSTIN: the same line carries 18%.
const taxed = priceSale({ company: withGst, customer, docType: taxInvoice, items: [line()] });
assert.equal(taxed.grandTotal, 1180);
console.log("gst on/off pricing: ok");

// 3. Selling rate copied to stock: changed rate updates the item; zero or blank never wipes it.
const item = await insert("inventory", { companyId: withGst.id, name: "Pipe", sellingPrice: 100, purchasePrice: 60, quantity: 5 });
const other = await insert("inventory", { companyId: noGst.id, name: "Pipe", sellingPrice: 100, quantity: 5 });
await syncSellingRates(withGst.id, [{ inventoryId: item.id, sellingPrice: 120 }], user.id);
assert.equal((await findById("inventory", item.id)).sellingPrice, 120);
assert.equal((await findById("inventory", item.id)).purchasePrice, 60); // purchase rate untouched
await syncSellingRates(withGst.id, [{ inventoryId: item.id, sellingPrice: 0 }, { inventoryId: item.id, sellingPrice: "" }], user.id);
assert.equal((await findById("inventory", item.id)).sellingPrice, 120);
await syncSellingRates(withGst.id, [{ inventoryId: other.id, sellingPrice: 999 }], user.id); // another company's item
assert.equal((await findById("inventory", other.id)).sellingPrice, 100);
console.log("selling rate sync: ok");

// 4. Deleting a payment: the bill's paid amount and its ledger lines follow.
async function sale(total) {
  return insert("sales", {
    companyId: withGst.id, customerId: customer.id, documentType: "Tax Invoice", invoiceNumber: `INV-${total}`,
    invoiceDate: "2026-11-01", items: [], subtotal: total, discount: 0, cgst: 0, sgst: 0, igst: 0,
    total, amountPaid: 0, status: "Unpaid", notes: ""
  });
}
const deletePayment = async (p) => { // same steps as DELETE /api/payments/[id]
  await query(`DELETE FROM ledger_entries WHERE "refId" = $1`, [p.id]);
  await remove("payments", p.id, user.id);
  if (p.refId) await recalcPaid(p.type, p.refId);
};

const s = await sale(1000);
const { payment: p1 } = await addPayment("SALE", s, { amount: 400, method: "Cash", notes: "first" });
const { payment: p2 } = await addPayment("SALE", s, { amount: 300, method: "Cash", notes: "second" });
assert.equal((await findById("sales", s.id)).amountPaid, 700);
await deletePayment(p1);
const after = await findById("sales", s.id);
assert.equal(after.amountPaid, 300);
assert.equal(after.status, "Partially Paid");
const left = await query(`SELECT COUNT(*) AS n FROM ledger_entries WHERE "refId" = $1`, [p1.id]);
assert.equal(left[0].n, 0);
await deletePayment(p2);
assert.equal((await findById("sales", s.id)).amountPaid, 0);
assert.equal((await findById("sales", s.id)).status, "Unpaid");

// Supplier side: a purchase bill's payment can be deleted the same way.
const bill = await insert("purchases", {
  companyId: withGst.id, supplierName: "Supplier X", billNumber: "B-1", billDate: "2026-11-01",
  items: [], subtotal: 500, cgst: 0, sgst: 0, igst: 0, total: 500, amountPaid: 0, status: "Unpaid", notes: ""
});
const { payment: pp } = await addPayment("PURCHASE", bill, { amount: 500, method: "Bank Transfer", notes: "paid" });
assert.equal((await findById("purchases", bill.id)).status, "Paid");
await deletePayment(pp);
assert.equal((await findById("purchases", bill.id)).amountPaid, 0);
assert.equal((await findById("purchases", bill.id)).status, "Unpaid");
console.log("payment delete (customer and supplier): ok");

console.log("\ngst and payments: all checks passed");
