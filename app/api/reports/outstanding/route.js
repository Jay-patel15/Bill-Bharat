import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest } from "@/lib/db";
import { outstandingStatement, PARTIES } from "@/lib/outstanding";

/** GET /api/reports/outstanding?party=customers|suppliers */
export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const party = new URL(req.url).searchParams.get("party") || "customers";
      if (!PARTIES[party]) return fail("party must be customers or suppliers", 400);
      return ok(await outstandingStatement(companyId, party));
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
