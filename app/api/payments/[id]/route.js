import { fail, ok, readBody, withUser } from "@/lib/api";
import { findById, findWhere, remove, update } from "@/lib/google/sheets";

// Recalculate sale's amountPaid from all remaining payment entries and update status
async function recalcSale(saleId) {
  const payments = await findWhere("payments", (p) => p.refId === saleId && p.type === "SALE");
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
  return withUser(async () => {
    try {
      const payment = await findById("payments", params.id);
      if (!payment) return fail("Payment not found", 404);
      const body = await readBody(req);
      const patch = {};
      if (body.amount !== undefined) patch.amount = Number(body.amount);
      if (body.method !== undefined) patch.method = body.method;
      if (body.notes !== undefined) patch.notes = body.notes;

      const updated = await update("payments", params.id, patch);
      await recalcSale(payment.refId);
      return ok(updated);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

// DELETE /api/payments/:id — delete a payment entry
export async function DELETE(_req, { params }) {
  return withUser(async () => {
    try {
      const payment = await findById("payments", params.id);
      if (!payment) return fail("Payment not found", 404);
      const saleId = payment.refId;
      await remove("payments", params.id);
      await recalcSale(saleId);
      return ok({ deleted: true });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
