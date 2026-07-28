import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findWhere, findById } from "@/lib/db";
import { recordLedgerEntry } from "@/lib/accounting";
import { expenseEntrySchema } from "@/lib/validations";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      
      const entries = await findWhere("ledger_entries", { companyId });
      entries.sort((a, b) => {
        const dateDiff = String(b.date || "").localeCompare(String(a.date || ""));
        if (dateDiff !== 0) return dateDiff;
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });
      
      return ok(entries);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function POST(req) {
  return withUser(async (user) => {
    try {
      const body = await readBody(req);
      const companyId = body.companyId || getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);

      const parse = expenseEntrySchema.safeParse({ ...body, companyId });
      if (!parse.success) {
        return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
      }
      const data = parse.data;
      const isIncome = data.entryType === "IN";

      // Resolve site/project name if projectId is provided
      let siteTag = "";
      if (data.projectId && data.projectId !== "none") {
        const proj = await findById("projects", data.projectId);
        if (proj && proj.companyId === companyId) {
          siteTag = ` [Site: ${proj.name}]`;
        }
      } else if (data.projectName) {
        siteTag = ` [Site: ${data.projectName}]`;
      }

      const description = `${data.description || data.category}${siteTag}`;
      const categoryLedgerName = `${data.category}${siteTag}`;
      const cashBankLedgerName = data.paymentMode || "Cash";
      const voucherType = isIncome ? "RECEIPT" : "EXPENSE";

      if (isIncome) {
        // IN (Jama / Income / Money Received):
        // Debit: Cash/Bank, Credit: Category/Income Ledger
        await recordLedgerEntry(companyId, {
          date: data.date,
          type: voucherType,
          refId: data.projectId || null,
          ledgerName: cashBankLedgerName,
          debit: data.amount,
          credit: 0,
          description
        });

        const creditEntry = await recordLedgerEntry(companyId, {
          date: data.date,
          type: voucherType,
          refId: data.projectId || null,
          ledgerName: categoryLedgerName,
          debit: 0,
          credit: data.amount,
          description
        });

        return ok(creditEntry);
      } else {
        // OUT (Udhar / Expense / Money Paid):
        // Debit: Category/Expense Ledger, Credit: Cash/Bank
        const debitEntry = await recordLedgerEntry(companyId, {
          date: data.date,
          type: voucherType,
          refId: data.projectId || null,
          ledgerName: categoryLedgerName,
          debit: data.amount,
          credit: 0,
          description
        });

        await recordLedgerEntry(companyId, {
          date: data.date,
          type: voucherType,
          refId: data.projectId || null,
          ledgerName: cashBankLedgerName,
          debit: 0,
          credit: data.amount,
          description
        });

        return ok(debitEntry);
      }
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
