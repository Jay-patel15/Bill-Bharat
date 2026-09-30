import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, findWhere, insert, update } from "@/lib/db";

export async function POST(req, { params }) {
  return withUser(async (user) => {
    try {
      const sale = await findById("sales", params.id);
      if (!sale) return fail("Sale not found", 404);
      await assertCompanyAccess(user, sale.companyId);

      const body = await readBody(req);
      const amount = Number(body.amount);
      if (isNaN(amount) || amount <= 0) {
        return fail("Valid payment amount required", 400);
      }

      const method = body.method || body.paymentMethod || "Cash";
      const notes = body.notes || `Payment for ${sale.invoiceNumber || "invoice"}`;
      const date = body.date || new Date().toISOString();

      // 1. Record payment entry
      const payment = await insert("payments", {
        companyId: sale.companyId,
        type: "SALE",
        refId: sale.id,
        amount,
        method,
        date,
        notes
      });

      // 2. Recalculate total amount paid and status
      const existingPayments = await findWhere("payments", { refId: sale.id });
      const newTotalPaid = (existingPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

      let newStatus = "Unpaid";
      if (newTotalPaid >= Number(sale.total || 0)) newStatus = "Paid";
      else if (newTotalPaid > 0) newStatus = "Partially Paid";

      await update("sales", sale.id, {
        amountPaid: newTotalPaid,
        status: newStatus
      });

      // 3. Update customer outstanding balance if customer exists
      if (sale.customerId) {
        const customer = await findById("customers", sale.customerId);
        if (customer) {
          const newOutstanding = Math.max(0, Number(customer.outstanding || 0) - amount);
          await update("customers", customer.id, { outstanding: newOutstanding });
        }
      }

      return ok({ payment, amountPaid: newTotalPaid, status: newStatus });
    } catch (e) {
      console.error("Payment creation error:", e);
      return fail(e.message, e.status || 500);
    }
  });
}

export async function GET(_req, { params }) {
  return withUser(async (user) => {
    try {
      const sale = await findById("sales", params.id);
      if (!sale) return fail("Sale not found", 404);
      await assertCompanyAccess(user, sale.companyId);

      const payments = await findWhere("payments", { refId: sale.id });
      const sorted = (payments || []).sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
      return ok(sorted);
    } catch (e) {
      return fail(e.message, e.status || 500);
    }
  });
}
