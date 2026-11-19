// Self-check: the party ledger per bill adds up to the combined ledger, each bill shows only its
// own lines, and both PDF layouts build. Uses a throwaway database in the OS temp folder.
// Run: node scripts/test-party-ledger-bills.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-ledger-bills-"));
process.env.BILLBHARAT_DATA_DIR = dir;

const { insert } = await import("../lib/db.js");
const { addPayment } = await import("../lib/accounting.js");
const { partyStatement } = await import("../lib/outstanding.js");
// lib/pdf.js imports "./gst" without an extension, so load it through jiti (Next's resolver).
const { createRequire } = await import("node:module");
const jiti = createRequire(import.meta.url)("jiti")(import.meta.url);
const { generateStatementPdf } = jiti("../lib/pdf.js");

const user = await insert("users", { id: "u-led", email: "led@test.local", role: "user" });
const company = await insert("companies", { userId: user.id, name: "Shop", stateCode: "27" });
const customer = await insert("customers", { companyId: company.id, name: "Buyer", stateCode: "27" });
const mk = (no, date, total) => insert("sales", {
  companyId: company.id, customerId: customer.id, invoiceNumber: no, documentType: "Tax Invoice",
  invoiceDate: date, total, subtotal: total, amountPaid: 0, status: "Unpaid", items: []
});
const b1 = await mk("INV/1", "2026-04-10", 1000);
const b2 = await mk("INV/2", "2026-05-02", 500);
const b3 = await mk("INV/3", "2026-06-01", 800);
await addPayment("SALE", b1, { amount: 300, method: "Cash", date: "2026-04-15" });
await addPayment("SALE", b1, { amount: 200, method: "UPI", date: "2026-05-20" });
await addPayment("SALE", b2, { amount: 500, method: "Cash", date: "2026-05-03" });

const st = await partyStatement(company.id, "customers", customer.id, "", "");
assert.equal(st.invoices.length, 3);
assert.equal(st.sections.length, 3, "one section per bill");

// Sections are in bill date order and each shows only its own bill's lines.
assert.deepEqual(st.sections.map((s) => s.bill.refNo), ["INV/1", "INV/2", "INV/3"]);
for (const s of st.sections) {
  assert.ok(s.ledger.every((e) => e.refNo === s.bill.refNo), `${s.bill.refNo} has only its own lines`);
  assert.equal(s.ledger[0].debit, s.bill.amount, "first line is the bill itself");
}
assert.equal(st.sections[0].ledger.length, 3, "INV/1: bill + two payments");
assert.equal(st.sections[0].closing, 500);
assert.equal(st.sections[1].closing, 0);
assert.equal(st.sections[2].closing, 800, "unpaid bill keeps its full amount");

// Sections add up to the combined ledger.
const sum = (k) => Math.round(st.sections.reduce((s, x) => s + x[k], 0) * 100) / 100;
assert.equal(sum("debitTotal"), st.debitTotal);
assert.equal(sum("creditTotal"), st.creditTotal);
assert.equal(sum("closing"), st.closing);
assert.equal(st.closing, 1300);

// Chosen bills only: the sections follow the selection.
const one = await partyStatement(company.id, "customers", customer.id, "", "", [b2.id]);
assert.equal(one.sections.length, 1);
assert.equal(one.sections[0].bill.refNo, "INV/2");

// Both layouts build a PDF.
const combined = generateStatementPdf({ company, statement: st, layout: "combined" });
const perBill = generateStatementPdf({ company, statement: st, layout: "bills" });
assert.equal(Buffer.from(combined).subarray(0, 4).toString(), "%PDF");
assert.equal(Buffer.from(perBill).subarray(0, 4).toString(), "%PDF");
assert.notDeepEqual(Buffer.from(combined), Buffer.from(perBill), "the two layouts differ");

console.log("party ledger per bill: sections match the combined ledger; both PDF layouts build");
fs.rmSync(dir, { recursive: true, force: true });
