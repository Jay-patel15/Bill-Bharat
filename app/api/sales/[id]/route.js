import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, remove, update } from "@/lib/db";

async function loadSale(user, id) {
  const s = await findById("sales", id);
  if (!s) { const e = new Error("Not found"); e.status = 404; throw e; }
  await assertCompanyAccess(user, s.companyId);
  return s;
}

export async function GET(_req, { params }) {
  return withUser(async (user) => {
    try {
      const { findWhere } = await import("@/lib/db");
      const sale = await loadSale(user, params.id);
      const payments = await findWhere("payments", (p) => p.refId === sale.id && p.type === "SALE");
      return ok({ ...sale, payments: (payments || []).sort((a, b) => new Date(b.date) - new Date(a.date)) });
    }
    catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function PUT(req, { params }) {
  return withUser(async (user) => {
    try {
      const sale = await loadSale(user, params.id);
      const body = await readBody(req);
      const allowed = ["status", "amountPaid", "notes", "dueDate", "pdfUrl"];
      const patch = {};
      for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k];
      if (patch.amountPaid !== undefined) patch.amountPaid = Number(patch.amountPaid);
      if (patch.dueDate !== undefined) patch.dueDate = patch.dueDate || null;

      // Recompute status if amountPaid changed without explicit status
      if (patch.amountPaid !== undefined && body.status === undefined) {
        if (patch.amountPaid >= Number(sale.total || 0)) patch.status = "Paid";
        else if (patch.amountPaid > 0) patch.status = "Partially Paid";
        else patch.status = "Unpaid";
      }

      // Update customer outstanding by the diff
      if (patch.amountPaid !== undefined && sale.customerId) {
        const customer = await findById("customers", sale.customerId);
        if (customer) {
          const diff = patch.amountPaid - Number(sale.amountPaid || 0);
          if (diff !== 0) {
            const { insert } = await import("@/lib/db");
            await insert("payments", {
              companyId: sale.companyId,
              type: "SALE",
              refId: sale.id,
              amount: diff,
              method: body.paymentMethod || "Cash",
              date: new Date().toISOString(),
              notes: body.notes || `Payment for ${sale.invoiceNumber}`
            });

            const newOut = Math.max(0, Number(customer.outstanding || 0) - diff);
            await update("customers", customer.id, { outstanding: newOut });
          }
        }
      }

      const updated = await update("sales", params.id, patch);
      return ok(updated);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function DELETE(_req, { params }) {
  return withUser(async (user) => {
    try {
      await loadSale(user, params.id);
      await remove("sales", params.id);
      return ok({ deleted: true });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
