import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findWhere, findById } from "@/lib/db";
import { recordSaleAccounting } from "@/lib/accounting";

export async function POST(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      
      const sales = await findWhere("sales", (s) => s.companyId === companyId);
      const existingEntries = await findWhere("ledger_entries", (l) => l.companyId === companyId);
      
      const synced = [];
      const skipped = [];
      
      for (const sale of sales) {
        // Check if this sale already has accounting entries
        const hasAccounting = existingEntries.some(e => e.refId === sale.id);
        
        if (!hasAccounting && (sale.documentType || "Tax Invoice") === "Tax Invoice") {
          const customer = await findById("customers", sale.customerId);
          if (customer) {
            await recordSaleAccounting(sale, customer.name);
            synced.push(sale.invoiceNumber);
          }
        } else {
          skipped.push(sale.invoiceNumber);
        }
      }
      
      return ok({ synced, skipped });
    } catch (e) { 
      return fail(e.message, e.status || 500); 
    }
  });
}
