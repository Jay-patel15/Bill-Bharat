import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest } from "@/lib/db";
import { findWhere } from "@/lib/db";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      
      const entries = await findWhere("ledger_entries", (l) => l.companyId === companyId);
      // Sort by date then by creation time
      entries.sort((a, b) => {
        const dateDiff = (b.date || "").localeCompare(a.date || "");
        if (dateDiff !== 0) return dateDiff;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
      
      return ok(entries);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
