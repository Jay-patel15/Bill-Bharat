import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess } from "@/lib/db";
import { findById, remove, update } from "@/lib/google/sheets";

async function loadSale(user, id) {
  const s = await findById("sales", id);
  if (!s) { const e = new Error("Not found"); e.status = 404; throw e; }
  await assertCompanyAccess(user, s.companyId);
  return s;
}

export async function GET(_req, { params }) {
  return withUser(async (user) => {
    try { return ok(await loadSale(user, params.id)); }
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
          const newOut = Math.max(0, Number(customer.outstanding || 0) - diff);
          await update("customers", customer.id, { outstanding: newOut });
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
