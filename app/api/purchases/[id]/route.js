import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess } from "@/lib/db";
import { findById, remove, update } from "@/lib/google/sheets";

async function loadPurchase(user, id) {
  const p = await findById("purchases", id);
  if (!p) { const e = new Error("Not found"); e.status = 404; throw e; }
  await assertCompanyAccess(user, p.companyId);
  return p;
}

export async function GET(_req, { params }) {
  return withUser(async (user) => {
    try { return ok(await loadPurchase(user, params.id)); }
    catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function PUT(req, { params }) {
  return withUser(async (user) => {
    try {
      await loadPurchase(user, params.id);
      const body = await readBody(req);
      const allowed = ["status", "amountPaid", "notes", "pdfUrl"];
      const patch = {};
      for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k];
      if (patch.amountPaid !== undefined) patch.amountPaid = Number(patch.amountPaid);
      const updated = await update("purchases", params.id, patch);
      return ok(updated);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function DELETE(_req, { params }) {
  return withUser(async (user) => {
    try {
      await loadPurchase(user, params.id);
      await remove("purchases", params.id);
      return ok({ deleted: true });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
