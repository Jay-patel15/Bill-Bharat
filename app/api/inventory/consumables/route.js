import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findWhere, insert, update } from "@/lib/db";

/**
 * POST { enabled } — turn the Electrical Works consumables line on or off.
 * The item is never deleted: invoices keep pointing at it. consumables = 1 is
 * active (offered on invoices), 2 is switched off (hidden from invoices, kept for history).
 */
export async function POST(req) {
  return withUser(async (user) => {
    try {
      const body = await readBody(req);
      const companyId = body.companyId || getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);

      const active = await findWhere("inventory", { companyId, consumables: 1 });
      const off = await findWhere("inventory", { companyId, consumables: 2 });
      if (body.enabled) {
        if (active.length === 0) {
          if (off.length > 0) await update("inventory", off[0].id, { consumables: 1 }, user.id);
          else await insert("inventory", {
            companyId, name: "Electrical Works", unit: "JOB", gstRate: 18,
            purchasePrice: 0, sellingPrice: 0, quantity: 0, lowStockThreshold: 0, consumables: 1
          });
        }
      } else {
        for (const row of active) await update("inventory", row.id, { consumables: 2 }, user.id);
      }
      return ok({ enabled: !!body.enabled });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
