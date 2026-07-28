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
      const allPurchases = await findWhere("purchases", { companyId: project.companyId });
      const allPayments = await findWhere("payments", { companyId: project.companyId });
      const allLedger = await findWhere("ledger_entries", { companyId: project.companyId });

      // Filter purchases for this project
      const sitePurchases = (allPurchases || []).filter((p) => 
        p.projectId === project.id || 
        (p.notes && p.notes.toLowerCase().includes(project.name.toLowerCase()))
      );

      // Filter site-specific ledger entries
      const siteLedger = (allLedger || []).filter((l) => 
        l.projectId === project.id || 
        (l.notes && l.notes.toLowerCase().includes(project.name.toLowerCase())) ||
        (l.description && l.description.toLowerCase().includes(project.name.toLowerCase()))
      );

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

      // Total Site Expenses (Udhar) = Purchases + Ledger Expenses
      const purchaseExpenses = sitePurchases.reduce((t, p) => t + Number(p.total || p.amount || 0), 0);
      const ledgerExpenses = siteLedger.reduce((t, l) => t + Number(l.debit || 0), 0);
      const siteUdhar = purchaseExpenses + ledgerExpenses;
      const siteJama = billed;

      // Construct Complete Passbook Statement Timeline
      const timeline = [];

      // 1. Sales Invoices (Jama - Billed to Customer)
      taxInvoices.forEach((s) => {
        timeline.push({
          id: `inv-${s.id}`,
          date: s.invoiceDate || s.createdAt,
          refNo: s.invoiceNumber,
          particulars: `Sales Invoice (Billed to ${customer?.name || "Builder"})`,
          jama: Number(s.total || 0),
          udhar: 0,
          type: "INVOICE"
        });
      });

      // 2. Payments Collected (Jama - Cash/Bank Payment Received)
      salesPayments.forEach((p) => {
        const inv = taxInvoices.find((s) => s.id === p.refId);
        timeline.push({
          id: `pay-${p.id}`,
          date: p.date || p.createdAt,
          refNo: inv ? inv.invoiceNumber : "RECEIPT",
          particulars: `Payment Received (${p.method || p.paymentMethod || "Cash/UPI"}) - ${p.notes || "Invoice Payment"}`,
          jama: Number(p.amount || 0),
          udhar: 0,
          type: "PAYMENT_RECEIVED"
        });
      });

      // 3. Purchase Bills (Udhar - Material/Services Purchased for Site)
      sitePurchases.forEach((pur) => {
        timeline.push({
          id: `pur-${pur.id}`,
          date: pur.billDate || pur.createdAt,
          refNo: pur.billNumber || "PURCHASE-BILL",
          particulars: `Purchase Bill from ${pur.supplierName || "Vendor"}`,
          jama: 0,
          udhar: Number(pur.total || pur.amount || 0),
          type: "PURCHASE"
        });
      });

      // 4. Daybook & Manual Ledger Expenses (Udhar/Jama)
      siteLedger.forEach((l) => {
        timeline.push({
          id: `led-${l.id}`,
          date: l.date || l.createdAt,
          refNo: l.voucherNo || "JV-ENTRY",
          particulars: l.description || l.accountName || "Site Daybook Entry",
          jama: Number(l.credit || 0),
          udhar: Number(l.debit || 0),
          type: "DAYBOOK"
        });
      });

      // Sort timeline chronologically (oldest first for accurate running balance)
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
        siteJama,
        siteUdhar,
        netSiteBalance: siteJama - siteUdhar,
        netCashPosition: collected - siteUdhar,
        billedPercent: contractValue ? Math.min(100, Math.round((billed / contractValue) * 100)) : 0,
        collectedPercent: contractValue ? Math.min(100, Math.round((collected / contractValue) * 100)) : 0,
        invoices: allSales.sort((a, b) => String(b.invoiceDate || "").localeCompare(String(a.invoiceDate || ""))),
        payments: salesPayments,
        statement: statementReversed
      });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
