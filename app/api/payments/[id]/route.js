import { z } from "zod";
import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, remove, update, query, transaction } from "@/lib/db";
import { recalcPaid, repostPayment } from "@/lib/accounting";

// Only these can change; type, refId and companyId stay as recorded.
const editSchema = z.object({
  amount: z.number().refine((n) => n !== 0, "Amount cannot be zero").optional(),
  method: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
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

      const updated = await transaction(async () => {
        const row = await update("payments", payment.id, parse.data, user.id);
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
