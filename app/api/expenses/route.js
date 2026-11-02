import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, query } from "@/lib/db";
import { CASH_LEDGERS } from "@/lib/accounting";
import { localDate } from "@/lib/utils";

/**
 * GET /api/expenses?month=YYYY-MM — expense vouchers for a month: the head
 * (debit) line of each, with the mode it was paid by and whether it can be deleted.
 */
export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const month = new URL(req.url).searchParams.get("month") || localDate().slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) return fail("month must be YYYY-MM", 400);

      const cash = CASH_LEDGERS.map((_, i) => `$${i + 3}`).join(", ");
      const rows = await query(
        `SELECT e.id, e."refId", e.date, e."ledgerName" AS head, e.description, e.debit AS amount,
                (SELECT c."ledgerName" FROM ledger_entries c WHERE c."refId" = e."refId" AND c.id <> e.id AND c.credit > 0 LIMIT 1) AS mode,
                (SELECT COUNT(*) FROM ledger_entries c WHERE c."refId" = e."refId") AS lines
         FROM ledger_entries e
         WHERE e."companyId" = $1 AND e.type = 'EXPENSE' AND e.debit > 0 AND substr(e.date, 1, 7) = $2
           AND e."ledgerName" NOT IN (${cash})
         ORDER BY e.date DESC, e."createdAt" DESC`,
        [companyId, month, ...CASH_LEDGERS]
      );
      return ok(rows.map(({ lines, ...r }) => ({ ...r, deletable: Boolean(r.refId) && lines === 2 })));
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
