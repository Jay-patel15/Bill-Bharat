/**
 * Lump sum: one amount settles a party's bills, oldest first. Each bill it touches gets an
 * ordinary payment row through addPayment, so the bill's history, the ledger and the
 * statement all show it like any other payment. Runs in one transaction: all or nothing.
 */
import { findWhere, transaction } from "./db.js";
import { addPayment } from "./accounting.js";
import { paymentState, allocateLumpSum, oldestFirst } from "./payments.js";
import { formatINR } from "./utils.js";

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function badRequest(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}

/**
 * kind "SALE": docs are sales invoices. kind "PURCHASE": docs are purchase bills.
 * Refuses an amount above the total pending, so nothing is paid that is not owed.
 */
export function payLumpSum(kind, docs, { amount, method }) {
  const amt = round2(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) throw badRequest("Enter an amount greater than zero");

  return transaction(async () => {
    const bills = [];
    for (const d of docs) {
      const rows = await findWhere("payments", { refId: d.id, type: kind });
      const { pending } = paymentState({ total: d.total, payments: rows });
      if (pending <= 0) continue;
      bills.push(kind === "SALE"
        ? { id: d.id, doc: d, pending, date: d.invoiceDate, number: d.invoiceNumber }
        : { id: d.id, doc: d, pending, date: d.billDate, number: d.billNumber });
    }
    if (!bills.length) throw badRequest("Nothing is pending on these bills");
    bills.sort(oldestFirst);

    const totalPending = round2(bills.reduce((s, b) => s + b.pending, 0));
    if (amt > totalPending) throw badRequest(`Amount is more than the total pending ${formatINR(totalPending)}`);

    const { parts } = allocateLumpSum(bills, amt);
    const allocations = [];
    for (const part of parts) {
      const bill = bills.find((b) => b.id === part.id);
      await addPayment(kind, bill.doc, { amount: part.amount, method, notes: `Part of lump sum of ${formatINR(amt)}` });
      allocations.push({ id: bill.id, number: bill.number, amount: part.amount });
    }
    return { total: amt, allocations };
  });
}
