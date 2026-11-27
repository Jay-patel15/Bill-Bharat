import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest } from "@/lib/db";
import { importInventory } from "@/lib/inventory-import";

export async function POST(req) {
  return withUser(async (user) => {
    try {
      const body = await readBody(req);
      const companyId = body.companyId || getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      return ok(await importInventory(companyId, body.rows));
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
