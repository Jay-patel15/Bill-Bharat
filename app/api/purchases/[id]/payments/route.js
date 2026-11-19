import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, findWhere, transaction } from "@/lib/db";
import { addPayment } from "@/lib/accounting";
import { paymentState, excessOver } from "@/lib/payments";

export async function POST(req, { params }) {
  return withUser(async (user) => {
    try {
      const bill = await findById("purchases", params.id);
      if (!bill) return fail("Bill not found", 404);
      await assertCompanyAccess(user, bill.companyId);
      if (bill.status === "Draft") return fail("Approve the bill before recording payments", 400);

      const body = await readBody(req);
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return fail("Valid payment amount required", 400);

      const rows = await findWhere("payments", { refId: bill.id, type: "PURCHASE" });
      const { pending } = paymentState({ total: bill.total, payments: rows });
      if (excessOver(amount, pending) > 0 && !body.acceptExcess) {
        return fail("Amount is more than the pending balance", 400);
      }

      const { payment, doc } = await transaction(() => addPayment("PURCHASE", bill, {
        amount,
        method: body.method || body.paymentMethod,
        date: body.date,
        notes: body.notes || `Payment for bill ${bill.billNumber || ""}`.trim()
      }));
      return ok({ payment, amountPaid: doc.amountPaid, status: doc.status });
    } catch (e) {
      return fail(e.message, e.status || 500);
    }
  });
}
