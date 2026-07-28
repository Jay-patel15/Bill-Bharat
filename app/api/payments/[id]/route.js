import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, findWhere, remove, update } from "@/lib/db";
import { paymentSchema } from "@/lib/validations";

// Recalculate sale's amountPaid from all remaining payment entries and update status
async function recalcSale(saleId) {
  const payments = await findWhere("payments", { refId: saleId });
  const newTotal = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const sale = await findById("sales", saleId);
  if (!sale) return;

  let newStatus = "Unpaid";
  if (newTotal >= Number(sale.total || 0)) newStatus = "Paid";
  else if (newTotal > 0) newStatus = "Partially Paid";

  await update("sales", saleId, { amountPaid: newTotal, status: newStatus });
}

// PUT /api/payments/:id — edit a payment entry
export async function PUT(req, { params }) {
  return withUser(async (user) => {
    try {
      const payment = await findById("payments", params.id);
      if (!payment) return fail("Payment not found", 404);
      await assertCompanyAccess(user, payment.companyId);

      const body = await readBody(req);
      const parse = paymentSchema.partial().safeParse(body);
      if (!parse.success) {
        return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
      }

      const updated = await update("payments", params.id, parse.data, user.id);
      if (payment.refId) await recalcSale(payment.refId);
      return ok(updated);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

// DELETE /api/payments/:id — delete a payment entry
export async function DELETE(_req, { params }) {
  return withUser(async (user) => {
    try {
      const payment = await findById("payments", params.id);
      if (!payment) return fail("Payment not found", 404);
      await assertCompanyAccess(user, payment.companyId);

      const saleId = payment.refId;
      await remove("payments", params.id, user.id);
      if (saleId) await recalcSale(saleId);
      return ok({ deleted: true });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
