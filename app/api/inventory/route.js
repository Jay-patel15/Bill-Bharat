import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findWhere, insert } from "@/lib/db";
import { inventorySchema } from "@/lib/validations";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const items = await findWhere("inventory", { companyId });
      return ok(items);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function POST(req) {
  return withUser(async (user) => {
    try {
      const body = await readBody(req);
      const companyId = body.companyId || getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      
      const payload = { ...body, companyId };
      const parse = inventorySchema.safeParse(payload);
      if (!parse.success) {
        return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
      }
      
      const created = await insert("inventory", parse.data);
      return ok(created);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
