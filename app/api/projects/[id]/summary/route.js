import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess } from "@/lib/db";
import { findById, findWhere } from "@/lib/google/sheets";

export async function GET(_req, { params }) {
  return withUser(async (user) => {
    try {
      const project = await findById("projects", params.id);
      if (!project) return fail("Not found", 404);
      await assertCompanyAccess(user, project.companyId);

      const customer = await findById("customers", project.customerId);
      const allSales = await findWhere("sales", (s) => s.companyId === project.companyId && s.projectId === project.id);

      // Only "Tax Invoice" reduces the contract / accrues outstanding;
      // PI/PO/QT are estimates and don't move the financial needle.
      const taxInvoices = allSales.filter((s) => (s.documentType || "Tax Invoice") === "Tax Invoice");
      const billed = taxInvoices.reduce((t, s) => t + Number(s.total || 0), 0);
      const collected = taxInvoices.reduce((t, s) => t + Number(s.amountPaid || 0), 0);
      const pending = Math.max(0, billed - collected);
      const contractValue = Number(project.contractValue || 0);
      const remaining = Math.max(0, contractValue - billed);
      const overBilled = Math.max(0, billed - contractValue);

      return ok({
        project,
        customer,
        contractValue,
        billed,
        collected,
        pending,
        remaining,
        overBilled,
        billedPercent: contractValue ? Math.min(100, Math.round((billed / contractValue) * 100)) : 0,
        collectedPercent: contractValue ? Math.min(100, Math.round((collected / contractValue) * 100)) : 0,
        invoices: allSales.sort((a, b) => (b.invoiceDate || "").localeCompare(a.invoiceDate || ""))
      });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
