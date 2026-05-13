import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest } from "@/lib/db";
import { findWhere } from "@/lib/db";

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

      const [sales, purchases, customers, inventory, projects] = await Promise.all([
        findWhere("sales", (s) => s.companyId === companyId),
        findWhere("purchases", (p) => p.companyId === companyId),
        findWhere("customers", (c) => c.companyId === companyId),
        findWhere("inventory", (i) => i.companyId === companyId),
        findWhere("projects", (pr) => pr.companyId === companyId)
      ]);

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

      // Per-project billing progress (Tax Invoice only).
      const projectStats = projects.map((p) => {
        const linked = sales.filter((s) => s.projectId === p.id && (s.documentType || "Tax Invoice") === "Tax Invoice");
        const billed = linked.reduce((t, s) => t + Number(s.total || 0), 0);
        const collected = linked.reduce((t, s) => t + Number(s.amountPaid || 0), 0);
        const cv = Number(p.contractValue || 0);
        return {
          id: p.id, name: p.name, code: p.code || "",
          status: p.status || "Active", customerId: p.customerId,
          contractValue: cv, billed, collected,
          pending: Math.max(0, billed - collected),
          remaining: Math.max(0, cv - billed),
          billedPercent: cv ? Math.min(100, Math.round((billed / cv) * 100)) : 0,
          collectedPercent: cv ? Math.min(100, Math.round((collected / cv) * 100)) : 0
        };
      });
      const projectTotals = projectStats.reduce((t, p) => ({
        contractValue: t.contractValue + p.contractValue,
        billed: t.billed + p.billed,
        collected: t.collected + p.collected
      }), { contractValue: 0, billed: 0, collected: 0 });

      return ok({
        totals: {
          sales: totalSales,
          purchases: totalPurchases,
          profit,
          receivable,
          payable,
          customers: customers.length,
          inventory: inventory.length,
          invoices: sales.length,
          projects: projects.length,
          activeProjects: projects.filter((p) => (p.status || "Active") === "Active").length,
          contractValue: projectTotals.contractValue,
          billedAgainstContracts: projectTotals.billed,
          collectedAgainstContracts: projectTotals.collected
        },
        monthly,
        lowStock,
        recentSales: [...sales]
          .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
          .slice(0, 5),
        projects: projectStats
          .filter((p) => p.status === "Active")
          .sort((a, b) => b.contractValue - a.contractValue)
          .slice(0, 6)
      });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

