import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, findWhere, getCompanyIdFromRequest } from "@/lib/db";
import { payLumpSum } from "@/lib/lump";
import { supplierKey } from "@/lib/payments";

/** POST /api/purchases/lump-payment  { supplierName, amount, method } — pays that supplier's bills oldest first. */
export async function POST(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);

      const body = await readBody(req);
      const key = supplierKey(body.supplierName);
      const bills = (await findWhere("purchases", { companyId }))
        .filter((p) => p.status !== "Draft" && supplierKey(p.supplierName) === key);
      return ok(await payLumpSum("PURCHASE", bills, { amount: body.amount, method: body.method || body.paymentMethod }));
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
