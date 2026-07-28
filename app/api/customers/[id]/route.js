import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, remove, update } from "@/lib/db";
import { customerSchema } from "@/lib/validations";

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
      const existing = await loadCustomer(user, params.id);
      const body = await readBody(req);
      delete body.id; delete body.companyId; delete body.createdAt;
      
      const parse = customerSchema.partial().safeParse(body);
      if (!parse.success) {
        return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
      }
      
      const updated = await update("customers", params.id, parse.data, user.id);
      return ok(updated);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function DELETE(_req, { params }) {
  return withUser(async (user) => {
    try {
      await loadCustomer(user, params.id);
      await remove("customers", params.id, user.id);
      return ok({ deleted: true });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
