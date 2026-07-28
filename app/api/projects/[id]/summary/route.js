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
      const allPayments = await findWhere("payments", { companyId: project.companyId });

      const taxInvoices = allSales.filter((s) => (s.documentType || "Tax Invoice") === "Tax Invoice");
      const salesIds = new Set(taxInvoices.map((s) => s.id));

      // Payments received for this project's sales invoices
      const salesPayments = (allPayments || []).filter((p) => salesIds.has(p.refId));

      const billed = taxInvoices.reduce((t, s) => t + Number(s.total || 0), 0);
      const collected = salesPayments.length > 0 
        ? salesPayments.reduce((t, p) => t + Number(p.amount || 0), 0)
        : taxInvoices.reduce((t, s) => t + Number(s.amountPaid || 0), 0);

      const pending = Math.max(0, billed - collected);
      const contractValue = Number(project.contractValue || 0);
      const remaining = Math.max(0, contractValue - billed);
      const overBilled = Math.max(0, billed - contractValue);

      // Construct Customer Site Passbook Statement Timeline (Udhar for Invoices, Jama for Payments)
      const timeline = [];

      // 1. Sales Invoices (Udhar - Customer Debt/Due)
      taxInvoices.forEach((s) => {
        timeline.push({
          id: `inv-${s.id}`,
          date: s.invoiceDate || s.createdAt,
          refNo: s.invoiceNumber,
          particulars: `Sales Invoice Billed to ${customer?.name || "Builder"}`,
          jama: 0,
          udhar: Number(s.total || 0),
          type: "INVOICE"
        });
      });

      // 2. Payments Collected (Jama - Cash/UPI/Bank Received)
      salesPayments.forEach((p) => {
        const inv = taxInvoices.find((s) => s.id === p.refId);
        timeline.push({
          id: `pay-${p.id}`,
          date: p.date || p.createdAt,
          refNo: inv ? inv.invoiceNumber : "RECEIPT",
          particulars: `Payment Received (${p.method || p.paymentMethod || "Cash/UPI"}) - ${p.notes || "Bill Settlement"}`,
          jama: Number(p.amount || 0),
          udhar: 0,
          type: "PAYMENT_RECEIVED"
        });
      });

      // Sort timeline chronologically (oldest first)
      timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Calculate running customer due balance (Udhar - Jama)
      let runningDue = 0;
      const statement = timeline.map((item) => {
        runningDue += (item.udhar - item.jama);
        return {
          ...item,
          runningBalance: Math.max(0, runningDue)
        };
      });

      // Reverse for UI presentation (newest first)
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
        siteJama: collected,
        siteUdhar: billed,
        billedPercent: contractValue ? Math.min(100, Math.round((billed / contractValue) * 100)) : 0,
        collectedPercent: contractValue ? Math.min(100, Math.round((collected / contractValue) * 100)) : 0,
        invoices: allSales.sort((a, b) => String(b.invoiceDate || "").localeCompare(String(a.invoiceDate || ""))),
        payments: salesPayments,
        statement: statementReversed
      });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
