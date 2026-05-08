import { fail, ok, readBody, withUser } from "@/lib/api";
import { findById, remove, update } from "@/lib/google/sheets";

export async function GET(_req, { params }) {
  return withUser(async (user) => {
    const c = await findById("companies", params.id);
    if (!c || c.userId !== user.id) return fail("Not found", 404);
    return ok(c);
  });
}

export async function PUT(req, { params }) {
  return withUser(async (user) => {
    const c = await findById("companies", params.id);
    if (!c || c.userId !== user.id) return fail("Not found", 404);
    const body = await readBody(req);
    delete body.id; delete body.userId; delete body.createdAt;
    const updated = await update("companies", params.id, body);
    return ok(updated);
  });
}

export async function DELETE(_req, { params }) {
  return withUser(async (user) => {
    const c = await findById("companies", params.id);
    if (!c || c.userId !== user.id) return fail("Not found", 404);
    await remove("companies", params.id);
    return ok({ deleted: true });
  });
}
