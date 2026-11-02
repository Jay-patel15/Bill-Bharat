import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, transaction } from "@/lib/db";
import { recordCashVoucher } from "@/lib/accounting";
import { voucherSchema } from "@/lib/validations";

/** POST a manual cash voucher: Rojmel receipt (IN), payment / expense (OUT) or contra (CONTRA). */
export async function POST(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const parse = voucherSchema.safeParse(await readBody(req));
      if (!parse.success) return fail(parse.error.errors[0]?.message || "Invalid entry", 400);
      return ok(await transaction(() => recordCashVoucher(companyId, parse.data)));
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
