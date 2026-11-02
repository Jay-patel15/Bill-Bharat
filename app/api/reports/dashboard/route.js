import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findWhere } from "@/lib/db";

function monthKey(d) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date)) return "";
  return date.toISOString().slice(0, 7);
}

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);

      const [allSales, allPurchases, customers, inventory] = await Promise.all([
        findWhere("sales", { companyId }),
        findWhere("purchases", { companyId }),
        findWhere("customers", { companyId }),
        findWhere("inventory", { companyId })
      ]);
      // Totals count real bills only, the same rule the GST and outstanding reports use.
      const sales = allSales.filter((s) => (s.documentType || "Tax Invoice") === "Tax Invoice");
      const purchases = allPurchases.filter((p) => p.status !== "Draft");

      const totalSales = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
      const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
      const profit = totalSales - totalPurchases;

      const receivable = sales.reduce(
        (s, x) => s + Math.max(0, Number(x.total || 0) - Number(x.amountPaid || 0)),
        0
      );
      const payable = purchases.reduce(
        (s, x) => s + Math.max(0, Number(x.total || 0) - Number(x.amountPaid || 0)),
        0
      );

      const months = {};
      for (const s of sales) {
        const k = monthKey(s.invoiceDate || s.createdAt);
        if (!k) continue;
        months[k] = months[k] || { month: k, sales: 0, purchases: 0 };
        months[k].sales += Number(s.total || 0);
      }
      for (const p of purchases) {
        const k = monthKey(p.billDate || p.createdAt);
        if (!k) continue;
        months[k] = months[k] || { month: k, sales: 0, purchases: 0 };
        months[k].purchases += Number(p.total || 0);
      }
      const monthly = Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

      const lowStock = inventory
        .filter((i) => Number(i.quantity || 0) <= Number(i.lowStockThreshold || 0) && Number(i.lowStockThreshold || 0) > 0)
        .slice(0, 10);

      return ok({
        totals: {
          sales: totalSales,
          purchases: totalPurchases,
          profit,
          receivable,
          payable,
          customers: customers.length,
          inventory: inventory.length,
          invoices: allSales.length
        },
        monthly,
        lowStock,
        recentSales: [...allSales]
          .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
          .slice(0, 5)
      });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

