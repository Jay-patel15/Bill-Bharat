import { z } from "zod";
import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, findWhere, remove, update, query, transaction } from "@/lib/db";
import { recalcPaid, repostPayment } from "@/lib/accounting";
import { paymentState, excessOver } from "@/lib/payments";

// Only these can change; type, refId and companyId stay as recorded.
const editSchema = z.object({
  amount: z.number().positive("Amount must be above zero").optional(),
  method: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Set after the user chose "Ignore and record anyway" on the overpayment warning.
  acceptExcess: z.boolean().optional()
});

async function loadPayment(user, id) {
  const payment = await findById("payments", id);
  if (!payment) { const e = new Error("Payment not found"); e.status = 404; throw e; }
  await assertCompanyAccess(user, payment.companyId);
  return payment;
}

export async function PUT(req, { params }) {
  return withUser(async (user) => {
    try {
      const payment = await loadPayment(user, params.id);
      const parse = editSchema.safeParse(await readBody(req));
      if (!parse.success) return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
      const { acceptExcess, ...fields } = parse.data;

      // The edited row is replaced, not added to: check the document total without its old amount.
      const doc = await findById(payment.type === "SALE" ? "sales" : "purchases", payment.refId);
      if (doc && fields.amount !== undefined && !acceptExcess) {
        const rows = await findWhere("payments", { refId: payment.refId, type: payment.type });
        const { room } = paymentState({ total: doc.total, payments: rows, editingId: payment.id });
        if (excessOver(fields.amount, room) > 0) {
          return fail("Total received would be more than the document total", 400);
        }
      }

      const updated = await transaction(async () => {
        const row = await update("payments", payment.id, fields, user.id);
        await repostPayment(row);
        if (row.refId) await recalcPaid(row.type, row.refId);
        return row;
      });
      return ok(updated);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function DELETE(_req, { params }) {
  return withUser(async (user) => {
    try {
      const payment = await loadPayment(user, params.id);
      await transaction(async () => {
        await query(`DELETE FROM ledger_entries WHERE "refId" = $1`, [payment.id]);
        await remove("payments", payment.id, user.id);
        if (payment.refId) await recalcPaid(payment.type, payment.refId);
      });
      return ok({ deleted: true });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
