import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findById } from "@/lib/db";
import { findWhere } from "@/lib/db";
import { generateGSTR1 } from "@/lib/gst-export";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      const company = await findById("companies", companyId);
      await assertCompanyAccess(user, companyId);
      
      const sales = await findWhere("sales", (s) => s.companyId === companyId);
      
      const json = generateGSTR1(company, sales);
      
      return ok(json);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
