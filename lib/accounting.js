import { insert, findOne, findWhere, update, findById, query } from "./db.js";
import { randomUUID } from "node:crypto";
import { localDate, PAYMENT_MODES } from "./utils.js";

/**
 * Standard Ledger Names (Common in Tally)
 */
export const LEDGERS = {
  SALES: "Sales Account",
  PURCHASE: "Purchase Account",
  CASH: "Cash",
  BANK: "Bank Account",
  GST_PAYABLE: "GST Payable",
  GST_RECEIVABLE: "GST Receivable",
  DISCOUNT_ALLOWED: "Discount Allowed",
  DISCOUNT_RECEIVED: "Discount Received",
  ROUND_OFF: "Round Off"
};

/** Cash/bank ledgers: one per payment mode, plus "Cash/Bank" for older unlabelled payments. */
export const CASH_LEDGERS = [...PAYMENT_MODES, "Cash/Bank"];

/**
 * Records an atomic ledger entry (Debit or Credit).
 */
export async function recordLedgerEntry(companyId, { date, type, refId, ledgerName, debit = 0, credit = 0, description = "" }) {
  return await insert("ledger_entries", {
    companyId,
    date: date || localDate(),
    type,
    refId,
    ledgerName,
    debit: Number(debit) || 0,
    credit: Number(credit) || 0,
    description
  });
}

/**
 * Automatically generates double-entry records for a Sale.
 */
export async function recordSaleAccounting(sale, customerName) {
  const { companyId, id, invoiceDate, invoiceNumber, total, subtotal, cgst, sgst, igst, discount } = sale;
  const refId = id;
  const date = invoiceDate;
  const desc = `Sale Inv #${invoiceNumber} to ${customerName}`;

  // 1. Debit Customer (Total amount including tax)
  await recordLedgerEntry(companyId, {
    date, type: "SALE", refId, ledgerName: customerName, debit: total, description: desc
  });

  // 2. Credit Sales at gross value; the discount is debited separately below.
  await recordLedgerEntry(companyId, {
    date, type: "SALE", refId, ledgerName: LEDGERS.SALES, credit: round2(Number(subtotal || 0) + Number(discount || 0)), description: desc
  });

  // 3. Credit GST (if any)
  if (cgst > 0) await recordLedgerEntry(companyId, { date, type: "SALE", refId, ledgerName: "CGST Output", credit: cgst, description: desc });
  if (sgst > 0) await recordLedgerEntry(companyId, { date, type: "SALE", refId, ledgerName: "SGST Output", credit: sgst, description: desc });
  if (igst > 0) await recordLedgerEntry(companyId, { date, type: "SALE", refId, ledgerName: "IGST Output", credit: igst, description: desc });

  // 4. Debit Discount (if any)
  if (discount > 0) await recordLedgerEntry(companyId, { date, type: "SALE", refId, ledgerName: LEDGERS.DISCOUNT_ALLOWED, debit: discount, description: desc });

  // 5. Rounding the total to whole rupees: the difference goes to Round Off so the voucher balances.
  const roundOff = round2(Number(total || 0) - Number(subtotal || 0) - Number(cgst || 0) - Number(sgst || 0) - Number(igst || 0));
  if (roundOff > 0) await recordLedgerEntry(companyId, { date, type: "SALE", refId, ledgerName: LEDGERS.ROUND_OFF, credit: roundOff, description: desc });
  if (roundOff < 0) await recordLedgerEntry(companyId, { date, type: "SALE", refId, ledgerName: LEDGERS.ROUND_OFF, debit: -roundOff, description: desc });
}


/**
 * Automatically generates double-entry records for a Payment (Receipt or Payment voucher).
 */
export async function recordPaymentAccounting(payment, partyName = "Customer", refDocNumber = "") {
  const { companyId, id, amount, method, date, type, notes } = payment;
  const pDate = date ? String(date).slice(0, 10) : localDate();
  const pMethod = PAYMENT_MODES.includes(method) ? method : "Cash/Bank";
  const docRefStr = refDocNumber ? ` #${refDocNumber}` : "";
  const desc = notes || (type === "PURCHASE" ? `Payment made for Bill${docRefStr} (${pMethod})` : `Payment received for Inv${docRefStr} (${pMethod})`);

  if (type === "PURCHASE") {
    // Money Paid OUT: Debit Vendor/Supplier, Credit Cash/Bank
    await recordLedgerEntry(companyId, {
      date: pDate,
      type: "PAYMENT",
      refId: id,
      ledgerName: partyName || "Supplier",
      debit: Number(amount) || 0,
      credit: 0,
      description: desc
    });

    await recordLedgerEntry(companyId, {
      date: pDate,
      type: "PAYMENT",
      refId: id,
      ledgerName: pMethod,
      debit: 0,
      credit: Number(amount) || 0,
      description: desc
    });
  } else {
    // Money Received IN (Receipt): Debit Cash/Bank, Credit Customer
    await recordLedgerEntry(companyId, {
      date: pDate,
      type: "RECEIPT",
      refId: id,
      ledgerName: pMethod,
      debit: Number(amount) || 0,
      credit: 0,
      description: desc
    });

    await recordLedgerEntry(companyId, {
      date: pDate,
      type: "RECEIPT",
      refId: id,
      ledgerName: partyName || "Customer",
      debit: 0,
      credit: Number(amount) || 0,
      description: desc
    });
  }
}



const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Purchase bill: Dr Purchase + GST input, Cr supplier. */
export async function recordPurchaseAccounting(p) {
  const { companyId, id: refId, billDate: date, billNumber, supplierName, total, subtotal, cgst, sgst, igst } = p;
  const desc = `Purchase Bill #${billNumber || "-"} from ${supplierName}`;
  const e = (ledgerName, debit, credit) => recordLedgerEntry(companyId, { date, type: "PURCHASE", refId, ledgerName, debit, credit, description: desc });
  await e(LEDGERS.PURCHASE, subtotal, 0);
  if (cgst > 0) await e("CGST Input", cgst, 0);
  if (sgst > 0) await e("SGST Input", sgst, 0);
  if (igst > 0) await e("IGST Input", igst, 0);
  await e(supplierName || "Supplier", 0, total);
}

const DOC = {
  SALE: { table: "sales", number: (d) => d.invoiceNumber },
  PURCHASE: { table: "purchases", number: (d) => d.billNumber }
};

async function partyName(kind, doc) {
  if (kind === "PURCHASE") return doc.supplierName || "Supplier";
  const c = doc.customerId ? await findById("customers", doc.customerId) : null;
  return c?.name || "Customer";
}

/** amountPaid and status always follow the payment rows. */
export async function recalcPaid(kind, id) {
  if (!DOC[kind]) return null;
  const { table } = DOC[kind];
  const doc = await findById(table, id);
  if (!doc) return null;
  const pays = await findWhere("payments", { refId: id, type: kind });
  const paid = round2(pays.reduce((s, p) => s + Number(p.amount || 0), 0));
  const status = paid >= Number(doc.total || 0) && paid > 0 ? "Paid" : paid > 0 ? "Partially Paid" : "Unpaid";
  return update(table, id, { amountPaid: paid, status });
}

/**
 * The one way to record money against a sale or purchase: payment row,
 * its two ledger lines, then the document's paid amount and status.
 * A negative amount is a correction.
 */
export async function addPayment(kind, doc, { amount, method, date, notes }) {
  const payment = await insert("payments", {
    companyId: doc.companyId, type: kind, refId: doc.id,
    amount: round2(amount), method: method || "Cash", date: date || localDate(), notes: notes || null
  });
  await recordPaymentAccounting(payment, await partyName(kind, doc), DOC[kind].number(doc));
  const updated = await recalcPaid(kind, doc.id);
  return { payment, doc: updated };
}

/** Rewrite a payment's ledger lines after it was edited. */
export async function repostPayment(payment) {
  await query(`DELETE FROM ledger_entries WHERE "refId" = $1`, [payment.id]);
  const doc = DOC[payment.type] ? await findById(DOC[payment.type].table, payment.refId) : null;
  await recordPaymentAccounting(payment, doc ? await partyName(payment.type, doc) : "Customer", doc ? DOC[payment.type].number(doc) : "");
}

/** Remove a sale/purchase's payments and every ledger line tied to it or them. */
export async function removeDocumentEntries(kind, id) {
  await query(
    `DELETE FROM ledger_entries WHERE "refId" = $1 OR "refId" IN (SELECT id FROM payments WHERE "refId" = $1 AND type = $2)`,
    [id, kind]
  );
  await query(`DELETE FROM payments WHERE "refId" = $1 AND type = $2`, [id, kind]);
}

/** Stock row a purchase line belongs to: by SKU first, then by name. Used by purchase create and delete. */
export async function findStockFor(companyId, it) {
  let inv = null;
  if (it.sku) inv = await findOne("inventory", { companyId, sku: it.sku });
  if (!inv && it.name) inv = await findOne("inventory", { companyId, name: it.name });
  return inv;
}

/**
 * A manual cash voucher (Rojmel entry or expense): two ledger lines sharing
 * one voucher id, so the pair can be listed and deleted together.
 *   IN : Dr <mode>  Cr <head>   (type RECEIPT)
 *   OUT: Dr <head>  Cr <mode>   (type EXPENSE)
 *   CONTRA: Dr <head> Cr <mode>, both cash/bank (type CONTRA), e.g. cash deposited in bank
 */
export async function recordCashVoucher(companyId, { direction, date, amount, mode, head, description }) {
  const refId = randomUUID();
  const type = direction === "IN" ? "RECEIPT" : direction === "CONTRA" ? "CONTRA" : "EXPENSE";
  const note = description || (direction === "CONTRA" ? `Contra: ${mode} to ${head}` : head);
  const line = (ledgerName, debit, credit) =>
    recordLedgerEntry(companyId, { date, type, refId, ledgerName, debit, credit, description: note });
  if (direction === "IN") {
    await line(mode, amount, 0);
    await line(head, 0, amount);
  } else {
    await line(head, amount, 0);
    await line(mode, 0, amount);
  }
  return { id: refId, type, date, amount, mode, head, description };
}

/** Delete a manual voucher. Refuses anything posted by a sale, purchase or payment. */
export async function deleteCashVoucher(companyId, refId) {
  const lines = await findWhere("ledger_entries", { companyId, refId });
  const manual = lines.length === 2 && lines.every((l) => ["RECEIPT", "EXPENSE", "CONTRA"].includes(l.type))
    && !(await findById("payments", refId));
  if (!manual) {
    const e = new Error("Only manual Rojmel or expense entries can be deleted here");
    e.status = 400;
    throw e;
  }
  await query(`DELETE FROM ledger_entries WHERE "companyId" = $1 AND "refId" = $2`, [companyId, refId]);
}
