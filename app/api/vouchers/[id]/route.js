import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, transaction } from "@/lib/db";
import { deleteCashVoucher } from "@/lib/accounting";

export async function DELETE(req, { params }) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      await transaction(() => deleteCashVoucher(companyId, params.id));
      return ok({ deleted: true });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
