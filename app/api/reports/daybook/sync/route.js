import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findWhere, findById } from "@/lib/db";
import { recordSaleAccounting, recordPaymentAccounting } from "@/lib/accounting";

export async function POST(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      
      const sales = await findWhere("sales", (s) => s.companyId === companyId);
      const payments = await findWhere("payments", (p) => p.companyId === companyId);
      const existingEntries = await findWhere("ledger_entries", (l) => l.companyId === companyId);
      
      const synced = [];
      const skipped = [];
      
      // 1. Sync Invoices
      for (const sale of sales) {
        const hasAccounting = existingEntries.some(e => e.refId === sale.id);
        
        if (!hasAccounting && (sale.documentType || "Tax Invoice") === "Tax Invoice") {
          const customer = await findById("customers", sale.customerId);
          if (customer) {
            await recordSaleAccounting(sale, customer.name);
            synced.push(`Invoice #${sale.invoiceNumber}`);
          }
        } else {
          skipped.push(`Invoice #${sale.invoiceNumber}`);
        }
      }

      // 2. Sync Payments (Receipts)
      for (const payment of payments) {
        const hasAccounting = existingEntries.some(e => e.refId === payment.id);
        if (!hasAccounting) {
          let partyName = "Customer";
          let refDocNumber = "";
          if (payment.type === "SALE" && payment.refId) {
            const sale = sales.find(s => s.id === payment.refId);
            if (sale) {
              refDocNumber = sale.invoiceNumber;
              if (sale.customerId) {
                const cust = await findById("customers", sale.customerId);
                if (cust) partyName = cust.name;
              }
            }
          }
          await recordPaymentAccounting(payment, partyName, refDocNumber);
          synced.push(`Payment ₹${payment.amount} (${payment.method || "Cash"})`);
        }
      }
      
      return ok({ synced, skipped });
    } catch (e) { 
      return fail(e.message, e.status || 500); 
    }
  });
}
