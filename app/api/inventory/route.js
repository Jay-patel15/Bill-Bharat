import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest } from "@/lib/db";
import { findWhere, insert } from "@/lib/db";

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
      if (!body.name) return fail("name required", 400);
      const created = await insert("inventory", {
        ...body,
        companyId,
        purchasePrice: Number(body.purchasePrice) || 0,
        sellingPrice: Number(body.sellingPrice) || 0,
        gstRate: Number(body.gstRate) || 0,
        quantity: Number(body.quantity) || 0,
        lowStockThreshold: Number(body.lowStockThreshold) || 0
      });
      return ok(created);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

