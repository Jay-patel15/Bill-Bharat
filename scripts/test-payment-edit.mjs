// Self-check: editing a payment changes that row in place, never adds one, and the party
// ledger shows it as a normal receipt (not a correction). Uses a throwaway database in the
// OS temp folder. Run: node scripts/test-payment-edit.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-pay-edit-"));
process.env.BILLBHARAT_DATA_DIR = dir;

const { insert, update, findById, query } = await import("../lib/db.js");
const { addPayment, recalcPaid, repostPayment } = await import("../lib/accounting.js");
const { partyStatement } = await import("../lib/outstanding.js");
const { paymentState, excessOver, sumPaid } = await import("../lib/payments.js");

const user = await insert("users", { id: "u-pay", email: "pay@test.local", role: "user" });
const company = await insert("companies", { userId: user.id, name: "Shop", stateCode: "27" });
const customer = await insert("customers", { companyId: company.id, name: "Buyer", stateCode: "27" });
const sale = await insert("sales", {
  companyId: company.id, customerId: customer.id, invoiceNumber: "INV/T/1", documentType: "Tax Invoice",
  invoiceDate: "2026-11-19", total: 1000, subtotal: 1000, amountPaid: 0, status: "Unpaid", items: []
});

const count = async () => (await query(`SELECT COUNT(*) AS n FROM payments WHERE "refId" = $1`, [sale.id]))[0].n;
const ledgerFor = async (id) => (await query(`SELECT COUNT(*) AS n FROM ledger_entries WHERE "refId" = $1`, [id]))[0].n;
const statement = () => partyStatement(company.id, "customers", customer.id, null, null);

// 1. Record a payment the way the app does.
const { payment } = await addPayment("SALE", sale, { amount: 300, method: "Cash", notes: "first" });
assert.equal(await count(), 1);
const ledgerBefore = await ledgerFor(payment.id);
assert.ok(ledgerBefore > 0, "payment posts ledger lines");

// 2. Edit it the way PUT /api/payments/[id] does (replace the row, repost, recalc).
const row = await update("payments", payment.id, { amount: 500, method: "UPI", notes: "UPI Ref: 1" });
await repostPayment(row);
await recalcPaid(row.type, row.refId);

assert.equal(await count(), 1, "edit must not add a payment row");
const after = await findById("payments", payment.id);
assert.equal(after.amount, 500);
assert.equal(after.method, "UPI");
assert.equal(await ledgerFor(payment.id), ledgerBefore, "edit reposts ledger lines, no extra ones");
assert.equal((await findById("sales", sale.id)).amountPaid, 500);

// 3. The party ledger shows one receipt with the edited amount, and no "Correction" line.
let st = await statement();
const payLines = st.ledger.filter((e) => e.credit > 0);
assert.equal(payLines.length, 1, "one payment line in the party ledger");
assert.equal(payLines[0].credit, 500);
assert.match(payLines[0].particulars, /^Received by UPI$/);
assert.ok(!st.ledger.some((e) => /correction/i.test(e.particulars)), "no correction line after an edit");
assert.equal(st.closing, 500, "balance = invoice total less what was received");

// 4. Shared arithmetic: room left while editing excludes the edited row's own amount.
const rows = await query(`SELECT * FROM payments WHERE "refId" = $1`, [sale.id]);
assert.equal(sumPaid(rows), 500);
assert.equal(paymentState({ total: 1000, payments: rows }).pending, 500);
assert.equal(paymentState({ total: 1000, payments: rows, editingId: payment.id }).room, 1000);
assert.equal(excessOver(1100, 1000), 100);
assert.equal(excessOver(1000, 1000), 0);

// 5. A legacy correction row (negative amount) still reads as a correction; new edits never create one.
const legacy = await addPayment("SALE", sale, { amount: 100, method: "Cash", notes: "x" });
await update("payments", legacy.payment.id, { amount: -100 });
await repostPayment(await findById("payments", legacy.payment.id));
await recalcPaid("SALE", sale.id);
st = await statement();
assert.ok(st.ledger.some((e) => /^Correction/.test(e.particulars)), "legacy negative row is labelled as a correction");

console.log("payment edit: one row, in place; party ledger shows a receipt; shared arithmetic correct");
fs.rmSync(dir, { recursive: true, force: true });
