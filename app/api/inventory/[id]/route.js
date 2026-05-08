import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess } from "@/lib/db";
import { findById, remove, update } from "@/lib/google/sheets";

async function loadItem(user, id) {
  const item = await findById("inventory", id);
  if (!item) { const e = new Error("Not found"); e.status = 404; throw e; }
  await assertCompanyAccess(user, item.companyId);
  return item;
}

export async function GET(_req, { params }) {
  return withUser(async (user) => {
    try { return ok(await loadItem(user, params.id)); }
    catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function PUT(req, { params }) {
  return withUser(async (user) => {
    try {
      await loadItem(user, params.id);
      const body = await readBody(req);
      delete body.id; delete body.companyId; delete body.createdAt;
      ["purchasePrice", "sellingPrice", "gstRate", "quantity", "lowStockThreshold"].forEach((k) => {
        if (body[k] !== undefined) body[k] = Number(body[k]);
      });
      const updated = await update("inventory", params.id, body);
      return ok(updated);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function DELETE(_req, { params }) {
  return withUser(async (user) => {
    try {
      await loadItem(user, params.id);
      await remove("inventory", params.id);
      return ok({ deleted: true });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
