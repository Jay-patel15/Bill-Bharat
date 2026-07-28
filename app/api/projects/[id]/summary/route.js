import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, findWhere } from "@/lib/db";

export async function GET(_req, { params }) {
  return withUser(async (user) => {
    try {
      const project = await findById("projects", params.id);
      if (!project) return fail("Not found", 404);
      await assertCompanyAccess(user, project.companyId);

      const customer = await findById("customers", project.customerId);
      const allSales = await findWhere("sales", { companyId: project.companyId, projectId: project.id });
      const allLedger = await findWhere("ledger_entries", { companyId: project.companyId });

      // Filter site-specific ledger entries
      const siteLedger = (allLedger || []).filter((l) => 
        l.projectId === project.id || 
        (l.notes && l.notes.toLowerCase().includes(project.name.toLowerCase())) ||
        (l.description && l.description.toLowerCase().includes(project.name.toLowerCase()))
      );

      const taxInvoices = allSales.filter((s) => (s.documentType || "Tax Invoice") === "Tax Invoice");
      const billed = taxInvoices.reduce((t, s) => t + Number(s.total || 0), 0);
      const collected = taxInvoices.reduce((t, s) => t + Number(s.amountPaid || 0), 0);
      const pending = Math.max(0, billed - collected);
      const contractValue = Number(project.contractValue || 0);
      const remaining = Math.max(0, contractValue - billed);
      const overBilled = Math.max(0, billed - contractValue);

      // Site Udhar (Expenses incurred for this site)
      const siteUdhar = siteLedger.reduce((t, l) => t + Number(l.debit || 0), 0);
      const siteJama = siteLedger.reduce((t, l) => t + Number(l.credit || 0), 0) + billed;

      // Construct Passbook Statement Timeline
      const timeline = [];

      taxInvoices.forEach((s) => {
        timeline.push({
          id: s.id,
          date: s.invoiceDate || s.createdAt,
          refNo: s.invoiceNumber,
          particulars: `Sales Invoice (Billed to ${customer?.name || "Builder"})`,
          jama: Number(s.total || 0),
          udhar: 0,
          type: "INVOICE"
        });
      });

      siteLedger.forEach((l) => {
        timeline.push({
          id: l.id,
          date: l.date || l.createdAt,
          refNo: l.voucherNo || "JV-ENTRY",
          particulars: l.description || l.accountName || "Site Transaction",
          jama: Number(l.credit || 0),
          udhar: Number(l.debit || 0),
          type: "DAYBOOK"
        });
      });

      // Sort timeline chronologically
      timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Calculate running balance
      let balance = 0;
      const statement = timeline.map((item) => {
        balance += (item.jama - item.udhar);
        return {
          ...item,
          runningBalance: balance
        };
      });

      // Reverse for display (newest first)
      const statementReversed = [...statement].reverse();

      return ok({
        project,
        customer,
        contractValue,
        billed,
        collected,
        pending,
        remaining,
        overBilled,
        siteJama,
        siteUdhar,
        netSiteBalance: siteJama - siteUdhar,
        billedPercent: contractValue ? Math.min(100, Math.round((billed / contractValue) * 100)) : 0,
        collectedPercent: contractValue ? Math.min(100, Math.round((collected / contractValue) * 100)) : 0,
        invoices: allSales.sort((a, b) => String(b.invoiceDate || "").localeCompare(String(a.invoiceDate || ""))),
        statement: statementReversed
      });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
