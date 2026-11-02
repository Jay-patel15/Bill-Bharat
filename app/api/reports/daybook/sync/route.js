import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findWhere, findById, query, transaction } from "@/lib/db";
import { recordSaleAccounting, recordPurchaseAccounting, recordPaymentAccounting } from "@/lib/accounting";

/**
 * One-off repair for books written before every sale, purchase and payment
 * posted its own ledger lines. Posts anything that has none; safe to re-run.
 */
export async function POST(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);

      const posted = new Set(
        (await query(`SELECT DISTINCT "refId" FROM ledger_entries WHERE "companyId" = $1`, [companyId])).map((r) => r.refId)
      );
      const sales = await findWhere("sales", { companyId });
      const purchases = await findWhere("purchases", { companyId });
      const payments = await findWhere("payments", { companyId });
      const salesById = new Map(sales.map((s) => [s.id, s]));
      const purchasesById = new Map(purchases.map((p) => [p.id, p]));
      const customerName = async (id) => (id ? (await findById("customers", id))?.name : null) || "Customer";

      const synced = [];
      await transaction(async () => {
        for (const sale of sales) {
          if (posted.has(sale.id) || (sale.documentType || "Tax Invoice") !== "Tax Invoice") continue;
          await recordSaleAccounting(sale, await customerName(sale.customerId));
          synced.push(`Invoice #${sale.invoiceNumber}`);
        }
        for (const p of purchases) {
          if (posted.has(p.id) || p.status === "Draft") continue;
          await recordPurchaseAccounting(p);
          synced.push(`Bill #${p.billNumber || p.id.slice(0, 8)}`);
        }
        for (const pay of payments) {
          if (posted.has(pay.id)) continue;
          const sale = pay.type === "SALE" ? salesById.get(pay.refId) : null;
          const bill = pay.type === "PURCHASE" ? purchasesById.get(pay.refId) : null;
          if (!sale && !bill) continue; // orphan of a deleted document
          const party = sale ? await customerName(sale.customerId) : bill.supplierName || "Supplier";
          await recordPaymentAccounting(pay, party, sale ? sale.invoiceNumber : bill.billNumber);
          synced.push(`Payment ₹${pay.amount} (${pay.method || "Cash"})`);
        }
      });

      return ok({ synced });
    } catch (e) {
      return fail(e.message, e.status || 500);
    }
  });
}
