import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess } from "@/lib/db";
import { findById, remove, update } from "@/lib/google/sheets";

async function loadCustomer(user, id) {
  const c = await findById("customers", id);
  if (!c) { const e = new Error("Not found"); e.status = 404; throw e; }
  await assertCompanyAccess(user, c.companyId);
  return c;
}

export async function GET(_req, { params }) {
  return withUser(async (user) => {
    try { return ok(await loadCustomer(user, params.id)); }
    catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function PUT(req, { params }) {
  return withUser(async (user) => {
    try {
      await loadCustomer(user, params.id);
      const body = await readBody(req);
      delete body.id; delete body.companyId; delete body.createdAt;
      const updated = await update("customers", params.id, body);
      return ok(updated);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function DELETE(_req, { params }) {
  return withUser(async (user) => {
    try {
      await loadCustomer(user, params.id);
      await remove("customers", params.id);
      return ok({ deleted: true });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
