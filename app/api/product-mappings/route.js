import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest } from "@/lib/db";
import { findWhere, insert } from "@/lib/google/sheets";

export async function GET(req) {
  return withUser(async (user) => {
    const companyId = getCompanyIdFromRequest(req);
    await assertCompanyAccess(user, companyId);
    const list = await findWhere("product_mappings", (r) => r.companyId === companyId);
    return ok(list);
  });
}

export async function POST(req) {
  return withUser(async (user) => {
    const companyId = getCompanyIdFromRequest(req);
    await assertCompanyAccess(user, companyId);
    const body = await readBody(req);
    if (!body.realName) return fail("realName required", 400);

    const created = await insert("product_mappings", {
      ...body,
      companyId
    });
    return ok(created);
  });
}
