// Self-check for editing an invoice's lines. Uses a throwaway database in the OS temp folder.
// Run: node scripts/test-sale-edit.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-sale-edit-"));
process.env.BILLBHARAT_DATA_DIR = dir;

const { insert, findById, findWhere, query } = await import("../lib/db.js");
const { recordSaleAccounting, addPayment } = await import("../lib/accounting.js");
const { checkConsumables, moveStock } = await import("../lib/consumables.js");
const { priceSale, editSale } = await import("../lib/sales.js");
const { getDocumentType } = await import("../lib/utils.js");

const user = await insert("users", { id: "u-edit", email: "edit@test.local", role: "user" });
// A GSTIN is set: without one the company bills with no GST, and these checks expect 18%.
const company = await insert("companies", { userId: user.id, name: "Edit Co", stateCode: "27", gstNumber: "27AAAAA0000A1Z5" });
const customer = await insert("customers", { companyId: company.id, name: "Customer A", stateCode: "27" });
const cable = await insert("inventory", { companyId: company.id, name: "6 sq mm wire", unit: "MTR", quantity: 60, purchasePrice: 50 });
const line = await insert("inventory", { companyId: company.id, name: "Electrical Works", unit: "JOB", consumables: 1 });

const stock = async (id) => Number((await findById("inventory", id)).quantity);
const ledgerBalance = async (refId) => {
  const [r] = await query(`SELECT SUM(debit) AS d, SUM(credit) AS c FROM ledger_entries WHERE "refId" = $1`, [refId]);
  return { debit: Math.round(r.d * 100) / 100, credit: Math.round(r.c * 100) / 100 };
};

// Create a document the way the app does: price it, store it, issue stock, post ledger.
async function makeSale(documentType, items, number) {
  const docType = getDocumentType(documentType);
  for (const it of items) it.consumablesUsed = await checkConsumables(company.id, it.inventoryId, it.consumablesUsed || []);
  const computed = priceSale({ company, customer, docType, items });
  const sale = await insert("sales", {
    companyId: company.id, customerId: customer.id, documentType: docType.value, invoiceNumber: number,
    invoiceDate: "2026-11-01", items: computed.items, subtotal: computed.subtotal, discount: 0,
    cgst: computed.cgst, sgst: computed.sgst, igst: computed.igst, total: computed.grandTotal,
    amountPaid: 0, status: "Unpaid", notes: ""
  });
  if (docType.affectsStock) await moveStock(company.id, computed.items, -1, user.id);
  if (docType.affectsOutstanding) await recordSaleAccounting(sale, customer.name);
  return sale;
}

const cableLine = (quantity) => ({ inventoryId: cable.id, name: "6 sq mm wire", quantity, sellingPrice: 100, gstRate: 18, unit: "MTR" });

// 1. Tax Invoice with 20 m wire: stock 40. Edit to 30 m: stock 30, ledger balanced, total follows.
const inv = await makeSale("Tax Invoice", [cableLine(20)], "INV/1");
assert.equal(await stock(cable.id), 40);
const edited = await editSale(user, inv, { items: [cableLine(30)], discount: 0, notes: "" });
assert.equal(await stock(cable.id), 30);
assert.equal(edited.total, 3540); // 30 m × 100 + 18% GST
assert.equal(edited.invoiceNumber, "INV/1");
let bal = await ledgerBalance(inv.id);
assert.equal(bal.debit, bal.credit);
assert.equal(bal.debit, edited.total);

// 2. Once a payment is recorded the invoice is locked: edit is refused, nothing changes.
await addPayment("SALE", edited, { amount: 500, date: "2026-11-01" });
const afterPay = await findById("sales", inv.id);
await assert.rejects(editSale(user, afterPay, { items: [cableLine(10)], discount: 0, notes: "" }), { status: 400 });
assert.equal(await stock(cable.id), 30);
assert.equal((await findById("sales", inv.id)).total, 3540);
bal = await ledgerBalance(inv.id);
assert.equal(bal.debit, bal.credit);
const payLines = await findWhere("ledger_entries", { companyId: company.id, type: "RECEIPT" });
assert.ok(payLines.length >= 2, "payment ledger lines are kept");

// 3. Consumables: lump-sum Electrical Works line plus 5 m of wire issued as parts.
const elecItem = (parts) => ({ inventoryId: line.id, name: "Electrical Works", quantity: 1, sellingPrice: 5000, gstRate: 18, unit: "JOB", consumablesUsed: parts });
const ti = await makeSale("Tax Invoice", [elecItem([{ inventoryId: cable.id, quantity: 5 }])], "INV/2");
assert.equal(await stock(cable.id), 25);
assert.equal(await stock(line.id), 0, "the Electrical Works line itself never moves stock");
const e3 = await editSale(user, ti, { items: [elecItem([{ inventoryId: cable.id, quantity: 8 }])], discount: 0, notes: "" });
assert.equal(await stock(cable.id), 22);
assert.equal(e3.items[0].consumablesUsed[0].quantity, 8);
assert.equal(e3.items[0].consumablesUsed[0].name, "6 sq mm wire");

// 4. Consumables are refused on a Delivery Challan, and stock is untouched by the refusal.
const dc = await makeSale("Delivery Challan", [cableLine(3)], "DC/1");
assert.equal(await stock(cable.id), 19);
await assert.rejects(
  editSale(user, dc, { items: [{ ...elecItem([{ inventoryId: cable.id, quantity: 1 }]), inventoryId: line.id }], notes: "" }),
  { status: 400 }
);
assert.equal(await stock(cable.id), 19);

// 5. Delivery Challan edit moves stock and posts no ledger lines.
const dc2 = await editSale(user, dc, { items: [cableLine(10)], notes: "" });
assert.equal(await stock(cable.id), 12);
assert.equal((await ledgerBalance(dc.id)).debit, 0);
assert.equal(dc2.total, 1000);

fs.rmSync(dir, { recursive: true, force: true });
console.log("sale edit: all checks passed");
