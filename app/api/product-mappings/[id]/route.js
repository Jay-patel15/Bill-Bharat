import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, remove } from "@/lib/db";

export async function DELETE(req, { params }) {
  return withUser(async (user) => {
    const companyId = getCompanyIdFromRequest(req);
    await assertCompanyAccess(user, companyId);
    const success = await remove("product_mappings", params.id);
    if (!success) return fail("Not found", 404);
    return ok({ success: true });
  });
}
