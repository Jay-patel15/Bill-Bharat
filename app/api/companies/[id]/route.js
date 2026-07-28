import { fail, ok, readBody, withUser } from "@/lib/api";
import { findById, remove, update } from "@/lib/db";
import { companySchema } from "@/lib/validations";

export async function GET(_req, { params }) {
  return withUser(async (user) => {
    const c = await findById("companies", params.id);
    if (!c || (user.role !== "admin" && c.userId !== user.id)) return fail("Not found", 404);
    return ok(c);
  });
}

export async function PUT(req, { params }) {
  return withUser(async (user) => {
    const c = await findById("companies", params.id);
    if (!c || (user.role !== "admin" && c.userId !== user.id)) return fail("Not found", 404);
    const body = await readBody(req);
    delete body.id; delete body.userId; delete body.createdAt;
    const parse = companySchema.partial().safeParse(body);
    if (!parse.success) {
      return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
    }
    const updated = await update("companies", params.id, parse.data, user.id);
    return ok(updated);
  });
}

export async function DELETE(_req, { params }) {
  return withUser(async (user) => {
    const c = await findById("companies", params.id);
    if (!c || (user.role !== "admin" && c.userId !== user.id)) return fail("Not found", 404);
    await remove("companies", params.id, user.id);
    return ok({ deleted: true });
  });
}
