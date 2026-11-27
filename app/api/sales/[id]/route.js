import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, findOne, findWhere, remove, update, transaction } from "@/lib/db";
import { removeDocumentEntries } from "@/lib/accounting";
import { getDocumentType } from "@/lib/utils";
import { moveStock } from "@/lib/consumables";
import { checkQuoteStatus, editSale } from "@/lib/sales";

async function loadSale(user, id) {
  const s = await findById("sales", id);
  if (!s) { const e = new Error("Not found"); e.status = 404; throw e; }
  await assertCompanyAccess(user, s.companyId);
  return s;
}

export async function GET(_req, { params }) {
  return withUser(async (user) => {
    try {
      const sale = await loadSale(user, params.id);
      const payments = await findWhere("payments", { refId: sale.id, type: "SALE" });
      return ok({ ...sale, payments: payments.sort((a, b) => new Date(b.date) - new Date(a.date)) });
    }
    catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function PUT(req, { params }) {
  return withUser(async (user) => {
    try {
      const sale = await loadSale(user, params.id);
      const body = await readBody(req);
      if (Array.isArray(body.items)) return ok(await editSale(user, sale, body));
      const patch = {};
      for (const k of ["status", "notes", "dueDate", "pdfUrl"]) if (body[k] !== undefined) patch[k] = body[k];
      if (patch.dueDate !== undefined) patch.dueDate = patch.dueDate || null;
      if (patch.status !== undefined && sale.documentType === "Quotation") patch.status = checkQuoteStatus(sale, patch.status);

      const updated = await transaction(async () => {
        // Payments are recorded and edited through /api/sales/[id]/payments and /api/payments/[id] only.
        return Object.keys(patch).length ? await update("sales", sale.id, patch, user.id) : sale;
      });
      return ok(updated);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function DELETE(_req, { params }) {
  return withUser(async (user) => {
    try {
      const sale = await loadSale(user, params.id);
      await transaction(async () => {
        if (getDocumentType(sale.documentType).affectsStock) await moveStock(sale.companyId, sale.items, 1, user.id);
        // An invoice made from a quotation: the quotation is open again, not pointing at a deleted invoice.
        const quote = await findOne("sales", { companyId: sale.companyId, convertedToId: sale.id });
        if (quote) await update("sales", quote.id, { status: "Accepted", convertedToId: null }, user.id);
        await removeDocumentEntries("SALE", sale.id);
        await remove("sales", sale.id, user.id);
      });
      return ok({ deleted: true });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
