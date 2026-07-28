import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest } from "@/lib/db";
import { findWhere } from "@/lib/db";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      
      const logs = await findWhere("audit_logs", { companyId });
      logs.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      
      return ok(logs.slice(0, 100)); // Return last 100 logs
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
