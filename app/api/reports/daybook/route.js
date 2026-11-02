import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, query } from "@/lib/db";
import { CASH_LEDGERS } from "@/lib/accounting";
import { localDate } from "@/lib/utils";

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * GET /api/reports/daybook?from=YYYY-MM-DD&to=YYYY-MM-DD — Rojmel (cash book).
 *
 * Only the cash/bank side of each voucher is listed, once: money in is Debit (jama field),
 * money out is Credit (udhar field). Opening balance is everything before `from`; each row
 * carries the running balance.
 */
export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const url = new URL(req.url);
      const to = url.searchParams.get("to") || localDate();
      const from = url.searchParams.get("from") || `${to.slice(0, 7)}-01`;
      if (![from, to].every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))) return fail("Dates must be YYYY-MM-DD", 400);

      const cash = CASH_LEDGERS.map((_, i) => `$${i + 4}`).join(", ");
      const params = [companyId, from, to, ...CASH_LEDGERS];

      const [{ opening }] = await query(
        `SELECT COALESCE(SUM(debit - credit), 0) AS opening FROM ledger_entries
         WHERE "companyId" = $1 AND date < $2 AND "ledgerName" IN (${cash})`,
        params
      );

      const lines = await query(
        `SELECT e.id, e."refId", e.date, e.type, e."ledgerName" AS mode, e.description, e.debit, e.credit,
                (SELECT group_concat(c."ledgerName", ', ') FROM ledger_entries c
                  WHERE c."refId" = e."refId" AND c.id <> e.id AND c."ledgerName" NOT IN (${cash})) AS particulars,
                (e.type IN ('RECEIPT', 'EXPENSE', 'CONTRA') AND e."refId" IS NOT NULL
                  AND (SELECT COUNT(*) FROM ledger_entries c WHERE c."refId" = e."refId") = 2
                  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = e."refId")) AS deletable
         FROM ledger_entries e
         WHERE e."companyId" = $1 AND e.date BETWEEN $2 AND $3 AND e."ledgerName" IN (${cash})
         ORDER BY e.date, e."createdAt"`,
        params
      );

      let balance = r2(opening);
      const rows = lines.map((l) => {
        balance = r2(balance + l.debit - l.credit);
        return {
          id: l.id,
          refId: l.refId,
          date: l.date,
          type: l.type,
          mode: l.mode,
          particulars: l.particulars || l.description || "",
          description: l.description || "",
          jama: l.debit,
          udhar: l.credit,
          balance,
          deletable: Boolean(l.deletable)
        };
      });

      return ok({
        from, to,
        opening: r2(opening),
        totalJama: r2(rows.reduce((s, r) => s + r.jama, 0)),
        totalUdhar: r2(rows.reduce((s, r) => s + r.udhar, 0)),
        closing: balance,
        rows
      });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
