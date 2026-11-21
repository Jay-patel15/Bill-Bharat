// Self-check: a lump sum pays the oldest bill first, carries the rest down the list, refuses
// more than is owed, and each bill's paid total and ledger lines match. Uses a throwaway
// database in the OS temp folder. Run: node scripts/test-lump-sum.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-lump-"));
process.env.BILLBHARAT_DATA_DIR = dir;

const { insert, findWhere, findById, query } = await import("../lib/db.js");
const { payLumpSum } = await import("../lib/lump.js");
const { allocateLumpSum, oldestFirst, supplierKey } = await import("../lib/payments.js");

// Pure split: oldest first, the rest stays untouched.
const bills = [{ id: "a", pending: 10000 }, { id: "b", pending: 20000 }, { id: "c", pending: 30000 }];
assert.deepEqual(allocateLumpSum(bills, 60000), {
  parts: [{ id: "a", amount: 10000 }, { id: "b", amount: 20000 }, { id: "c", amount: 30000 }], left: 0
});
assert.deepEqual(allocateLumpSum(bills, 25000).parts, [{ id: "a", amount: 10000 }, { id: "b", amount: 15000 }]);
assert.deepEqual(allocateLumpSum([{ id: "x", pending: 0.1 + 0.2 }], 0.3).parts, [{ id: "x", amount: 0.3 }], "no float drift");
assert.equal(supplierKey("  ABC Traders "), supplierKey("abc traders"));
assert.equal(supplierKey(""), "unknown supplier");
assert.ok(oldestFirst({ date: "2026-01-01", number: "2" }, { date: "2026-01-01", number: "10" }) < 0, "INV/2 before INV/10");

// Database: three invoices of 10k, 20k, 30k, the oldest dated first.
const user = await insert("users", { id: "u-lump", email: "lump@test.local", role: "user" });
const company = await insert("companies", { userId: user.id, name: "Shop", stateCode: "27" });
const customer = await insert("customers", { companyId: company.id, name: "Buyer", stateCode: "27" });
const mk = (no, date, total) => insert("sales", {
  companyId: company.id, customerId: customer.id, invoiceNumber: no, documentType: "Tax Invoice",
  invoiceDate: date, total, subtotal: total, amountPaid: 0, status: "Unpaid", items: []
});
const s1 = await mk("INV/1", "2026-04-01", 10000);
const s2 = await mk("INV/2", "2026-05-01", 20000);
const s3 = await mk("INV/3", "2026-06-01", 30000);

const sales = () => findWhere("sales", { companyId: company.id, customerId: customer.id });
const rowsOf = (id) => findWhere("payments", { refId: id, type: "SALE" });

// Over what is owed: refused, nothing recorded.
await assert.rejects(async () => payLumpSum("SALE", await sales(), { amount: 60001, method: "Cash" }), /more than the total pending/);
assert.equal((await findWhere("payments", { companyId: company.id })).length, 0, "a refused lump sum records nothing");
await assert.rejects(async () => payLumpSum("SALE", await sales(), { amount: 0, method: "Cash" }), /greater than zero/);

// 25,000 by UPI: INV/1 cleared, INV/2 part paid, INV/3 untouched.
const r = await payLumpSum("SALE", await sales(), { amount: "25000", method: "UPI" });
assert.equal(r.total, 25000);
assert.deepEqual(r.allocations.map((a) => [a.number, a.amount]), [["INV/1", 10000], ["INV/2", 15000]]);

const after = Object.fromEntries((await sales()).map((s) => [s.invoiceNumber, s]));
assert.equal(after["INV/1"].status, "Paid");
assert.equal(Number(after["INV/1"].amountPaid), 10000);
assert.equal(after["INV/2"].status, "Partially Paid");
assert.equal(Number(after["INV/2"].amountPaid), 15000);
assert.equal(after["INV/3"].status, "Unpaid");
assert.equal(Number(after["INV/3"].amountPaid), 0);
assert.equal((await rowsOf(s3.id)).length, 0, "INV/3 gets no payment row");
assert.equal((await rowsOf(s1.id))[0].method, "UPI");
assert.match((await rowsOf(s2.id))[0].notes, /Part of lump sum of/);

// Each payment row has its two ledger lines (cash/bank in, customer credit).
for (const p of await query(`SELECT id FROM payments WHERE "refId" IN ($1, $2)`, [s1.id, s2.id])) {
  const lines = await query(`SELECT COUNT(*) AS n FROM ledger_entries WHERE "refId" = $1`, [p.id]);
  assert.equal(Number(lines[0].n), 2, "two ledger lines per payment");
}

// Remaining pending is 5,000 + 30,000 = 35,000: one more over-amount is refused, exact amount clears all.
await assert.rejects(async () => payLumpSum("SALE", await sales(), { amount: 35001, method: "Cash" }), /35,000/);
const last = await payLumpSum("SALE", await sales(), { amount: 35000, method: "Cash" });
assert.deepEqual(last.allocations.map((a) => [a.number, a.amount]), [["INV/2", 5000], ["INV/3", 30000]]);
for (const s of await sales()) assert.equal(s.status, "Paid", `${s.invoiceNumber} fully paid`);
await assert.rejects(async () => payLumpSum("SALE", await sales(), { amount: 1, method: "Cash" }), /Nothing is pending/);

// Purchase bills go through the same path (kind PURCHASE).
const bill = await insert("purchases", { companyId: company.id, supplierName: "ABC", billNumber: "B-1", billDate: "2026-03-01", total: 500, subtotal: 500, amountPaid: 0, status: "Unpaid", items: [] });
const pr = await payLumpSum("PURCHASE", [await findById("purchases", bill.id)], { amount: 200, method: "Bank Transfer" });
assert.deepEqual(pr.allocations.map((a) => [a.number, a.amount]), [["B-1", 200]]);
assert.equal((await findById("purchases", bill.id)).status, "Partially Paid");

console.log("lump-sum self-check passed");
