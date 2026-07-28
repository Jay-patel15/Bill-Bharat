import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, remove, update } from "@/lib/db";
import { inventorySchema } from "@/lib/validations";

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
      
      const parse = inventorySchema.partial().safeParse(body);
      if (!parse.success) {
        return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
      }

      const updated = await update("inventory", params.id, parse.data, user.id);
      return ok(updated);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function DELETE(_req, { params }) {
  return withUser(async (user) => {
    try {
      await loadItem(user, params.id);
      await remove("inventory", params.id, user.id);
      return ok({ deleted: true });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
