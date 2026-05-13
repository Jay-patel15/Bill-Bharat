import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest } from "@/lib/db";
import { findWhere, insert } from "@/lib/db";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const customers = await findWhere("customers", (c) => c.companyId === companyId);
      return ok(customers);
    } catch (e) {
      return fail(e.message, e.status || 500);
    }
  });
}

export async function POST(req) {
  return withUser(async (user) => {
    try {
      const body = await readBody(req);
      const companyId = body.companyId || getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      if (!body.name) return fail("name required", 400);
      const created = await insert("customers", {
        ...body,
        companyId,
        outstanding: Number(body.outstanding) || 0,
        creditLimit: Number(body.creditLimit) || 0
      });
      return ok(created);
    } catch (e) {
      return fail(e.message, e.status || 500);
    }
  });
}

