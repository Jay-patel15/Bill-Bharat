import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, findWhere, transaction } from "@/lib/db";
import { addPayment } from "@/lib/accounting";
import { paymentState, excessOver } from "@/lib/payments";

export async function POST(req, { params }) {
  return withUser(async (user) => {
    try {
      const sale = await findById("sales", params.id);
      if (!sale) return fail("Sale not found", 404);
      await assertCompanyAccess(user, sale.companyId);

      const body = await readBody(req);
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return fail("Valid payment amount required", 400);

      // Above the pending balance only when the user chose "Ignore and record anyway".
      const rows = await findWhere("payments", { refId: sale.id, type: "SALE" });
      const { pending } = paymentState({ total: sale.total, payments: rows });
      if (excessOver(amount, pending) > 0 && !body.acceptExcess) {
        return fail("Amount is more than the pending balance", 400);
      }

      const { payment, doc } = await transaction(() => addPayment("SALE", sale, {
        amount,
        method: body.method || body.paymentMethod,
        date: body.date,
        notes: body.notes || `Payment for ${sale.invoiceNumber || "invoice"}`
      }));
      return ok({ payment, amountPaid: doc.amountPaid, status: doc.status });
    } catch (e) {
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
      const payments = await findWhere("payments", { refId: sale.id, type: "SALE" });
      return ok(payments.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)));
    } catch (e) {
      return fail(e.message, e.status || 500);
    }
  });
}
