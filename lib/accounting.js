import { insert, findWhere, update, findById } from "./db";

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
  DISCOUNT_RECEIVED: "Discount Received"
};

/**
 * Records an atomic ledger entry (Debit or Credit).
 */
export async function recordLedgerEntry(companyId, { date, type, refId, ledgerName, debit = 0, credit = 0, description = "" }) {
  return await insert("ledger_entries", {
    companyId,
    date: date || new Date().toISOString().slice(0, 10),
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

  // 2. Credit Sales (Taxable amount)
  await recordLedgerEntry(companyId, {
    date, type: "SALE", refId, ledgerName: LEDGERS.SALES, credit: subtotal, description: desc
  });

  // 3. Credit GST (if any)
  if (cgst > 0) await recordLedgerEntry(companyId, { date, type: "SALE", refId, ledgerName: "CGST Output", credit: cgst, description: desc });
  if (sgst > 0) await recordLedgerEntry(companyId, { date, type: "SALE", refId, ledgerName: "SGST Output", credit: sgst, description: desc });
  if (igst > 0) await recordLedgerEntry(companyId, { date, type: "SALE", refId, ledgerName: "IGST Output", credit: igst, description: desc });

  // 4. Debit Discount (if any)
  if (discount > 0) await recordLedgerEntry(companyId, { date, type: "SALE", refId, ledgerName: LEDGERS.DISCOUNT_ALLOWED, debit: discount, description: desc });
}

/**
 * Records a Manual Journal Entry.
 */
export async function recordJournalEntry(companyId, { date, description, entries }) {
  // entries: [{ ledgerName, debit, credit }]
  const totalDebit = entries.reduce((s, e) => s + (Number(e.debit) || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (Number(e.credit) || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error("Journal entry must be balanced (Debits must equal Credits)");
  }

  const journal = await insert("journal_entries", {
    companyId,
    date: date || new Date().toISOString().slice(0, 10),
    description,
    entries // Store the original entries array in JSON
  });

  for (const entry of entries) {
    await recordLedgerEntry(companyId, {
      date: journal.date,
      type: "JOURNAL",
      refId: journal.id,
      ledgerName: entry.ledgerName,
      debit: entry.debit,
      credit: entry.credit,
      description
    });
  }

  return journal;
}
