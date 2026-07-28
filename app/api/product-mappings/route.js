import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findWhere, insert } from "@/lib/db";
import { productMappingSchema } from "@/lib/validations";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const list = await findWhere("product_mappings", { companyId });
      return ok(list);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function POST(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const body = await readBody(req);

      const parse = productMappingSchema.safeParse({ ...body, companyId });
      if (!parse.success) {
        return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
      }

      const created = await insert("product_mappings", parse.data);
      return ok(created);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
