/**
 * Outstanding statement (unpaid bills grouped by party) and party statement
 * (one party's bills, payments and running balance).
 *   customers — Tax Invoices with a balance, grouped by customer (what they owe you)
 *   suppliers — purchase bills with a balance, grouped by supplier name (what you owe)
 * Used by the report page (through /api/reports/outstanding) and the PDF, so both always agree.
 */
import { findWhere } from "./db.js";
import { localDate } from "./utils.js";

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const DAY = 24 * 60 * 60 * 1000;

function daysOverdue(due, today) {
  if (!due) return 0;
  const d = Math.round((Date.parse(today) - Date.parse(String(due).slice(0, 10))) / DAY);
  return d > 0 ? d : 0;
}

export const PARTIES = {
  customers: { label: "Customers", title: "Customer outstanding (receivable)" },
  suppliers: { label: "Suppliers", title: "Supplier outstanding (payable)" }
};

/** Suppliers have no table of their own: bills are matched on the typed name, ignoring case and spaces. */
const supplierKey = (name) => String(name || "").trim().toLowerCase();

/** Real bills for one party type: Tax Invoices, or purchases that are not drafts. */
async function billsOf(companyId, party) {
  if (party === "suppliers") {
    return (await findWhere("purchases", { companyId }))
      .filter((p) => p.status !== "Draft")
      .map((p) => ({ id: p.id, key: supplierKey(p.supplierName) || "unknown supplier", name: (p.supplierName || "").trim() || "Unknown Supplier",
        date: p.billDate, refNo: p.billNumber || "—", amount: r2(p.total), paid: r2(p.amountPaid) }));
  }
  const names = new Map((await findWhere("customers", { companyId })).map((c) => [c.id, c.name]));
  return (await findWhere("sales", { companyId }))
    .filter((s) => (s.documentType || "Tax Invoice") === "Tax Invoice" && s.customerId)
    .map((s) => ({ id: s.id, key: s.customerId, name: names.get(s.customerId) || "Unknown Customer",
      date: s.invoiceDate, refNo: s.invoiceNumber, amount: r2(s.total), paid: r2(s.amountPaid) }));
}

/** Every party that has at least one bill, with its current balance. */
export async function partiesWithBills(companyId, party) {
  const m = new Map();
  for (const b of await billsOf(companyId, party)) {
    const g = m.get(b.key) || { key: b.key, name: b.name, balance: 0 };
    g.balance = r2(g.balance + b.amount - b.paid);
    m.set(b.key, g);
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * One party's ledger for [from, to]: bills (debit) and payments (credit) in
 * date order with running balance, starting from the balance carried in from
 * before `from`. `ids` limits it to chosen bills (empty = all the party's bills).
 * `invoices` lists every bill of the party so the caller can offer the choice.
 */
export async function partyStatement(companyId, party, key, from, to, ids = []) {
  const all = (await billsOf(companyId, party)).filter((b) => b.key === key);
  if (!all.length) return null;
  const pick = new Set(ids);
  const bills = pick.size ? all.filter((b) => pick.has(b.id)) : all;
  const type = party === "suppliers" ? "PURCHASE" : "SALE";
  const refNo = new Map(bills.map((b) => [b.id, b.refNo]));
  const payments = (await findWhere("payments", { companyId, type })).filter((p) => refNo.has(p.refId));
  const inRange = (d) => (!from || d >= from) && (!to || d <= to);
  const day = (d) => String(d || "").slice(0, 10);

  const events = [
    ...bills.map((b) => ({ date: day(b.date), sort: 0, particulars: party === "suppliers" ? "Purchase bill" : "Sales invoice", refNo: b.refNo, debit: b.amount, credit: 0 })),
    ...payments.map((p) => ({ date: day(p.date || p.createdAt), sort: 1,
      particulars: Number(p.amount) < 0 ? `Correction (${p.method || "Cash"})` : `${party === "suppliers" ? "Paid" : "Received"} by ${p.method || "Cash"}`,
      refNo: refNo.get(p.refId), debit: 0, credit: r2(p.amount) }))
  ].sort((a, b) => a.date.localeCompare(b.date) || a.sort - b.sort);

  const opening = r2(events.filter((e) => from && e.date < from).reduce((s, e) => s + e.debit - e.credit, 0));
  let balance = opening;
  const ledger = events.filter((e) => inRange(e.date)).map(({ sort, ...e }) => {
    balance = r2(balance + e.debit - e.credit);
    return { ...e, balance };
  });

  return {
    party, key, name: all[0].name, from: from || "", to: to || "",
    ids: [...pick].filter((id) => refNo.has(id)),
    invoices: [...all].sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((b) => ({ id: b.id, date: b.date, refNo: b.refNo, amount: b.amount, balance: r2(b.amount - b.paid) })),
    opening,
    ledger,
    debitTotal: r2(ledger.reduce((s, e) => s + e.debit, 0)),
    creditTotal: r2(ledger.reduce((s, e) => s + e.credit, 0)),
    closing: balance
  };
}

export async function outstandingStatement(companyId, party) {
  const today = localDate();
  const groups = new Map();
  const add = (key, name, row) => {
    if (!groups.has(key)) groups.set(key, { id: key, name, rows: [], totalPending: 0 });
    const g = groups.get(key);
    g.rows.push(row);
    g.totalPending = r2(g.totalPending + row.pendingAmount);
  };

  if (party === "suppliers") {
    for (const p of await findWhere("purchases", { companyId })) {
      const pending = r2(Number(p.total || 0) - Number(p.amountPaid || 0));
      if (p.status === "Draft" || pending <= 0) continue;
      const name = (p.supplierName || "").trim() || "Unknown Supplier";
      add(supplierKey(name), name, {
        date: p.billDate, refNo: p.billNumber || "—",
        billAmount: r2(p.total), paid: r2(p.amountPaid), pendingAmount: pending,
        dueOn: p.billDate, overdueDays: daysOverdue(p.billDate, today)
      });
    }
  } else {
    const names = new Map((await findWhere("customers", { companyId })).map((c) => [c.id, c.name]));
    for (const s of await findWhere("sales", { companyId })) {
      const pending = r2(Number(s.total || 0) - Number(s.amountPaid || 0));
      if ((s.documentType || "Tax Invoice") !== "Tax Invoice" || pending <= 0 || !s.customerId) continue;
      const dueOn = s.dueDate || s.invoiceDate;
      add(s.customerId, names.get(s.customerId) || "Unknown Customer", {
        date: s.invoiceDate, refNo: s.invoiceNumber,
        billAmount: r2(s.total), paid: r2(s.amountPaid), pendingAmount: pending,
        dueOn, overdueDays: daysOverdue(dueOn, today)
      });
    }
  }

  const parties = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const g of parties) g.rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return {
    party,
    parties,
    totalAmount: r2(parties.reduce((s, g) => s + g.totalPending, 0)),
    totalParties: parties.length
  };
}
