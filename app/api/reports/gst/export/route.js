import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findById, findWhere } from "@/lib/db";
import { generateGSTR1 } from "@/lib/gst-export";
import { localDate } from "@/lib/utils";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const company = await findById("companies", companyId);
      if (!company) return fail("Company not found", 404);

      // GSTR-1 is monthly: the period is the month of `from` (default: this month).
      const url = new URL(req.url);
      const period = (url.searchParams.get("from") || localDate()).slice(0, 7);
      const sales = (await findWhere("sales", { companyId }))
        .filter((s) => String(s.invoiceDate || "").startsWith(period));
      const customers = new Map((await findWhere("customers", { companyId })).map((c) => [c.id, c]));

      return ok(generateGSTR1(company, sales, customers, period));
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
