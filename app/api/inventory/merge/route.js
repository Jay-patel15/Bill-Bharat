import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess } from "@/lib/db";
import { findById, remove, update } from "@/lib/google/sheets";

/**
 * POST /api/inventory/merge
 * Body: { masterId, duplicateId }
 *
 * Adds the duplicate's quantity to the master, then deletes the duplicate.
 * The master record keeps its own name, SKU, HSN, prices, etc.
 */
export async function POST(req) {
  return withUser(async (user) => {
    try {
      const { masterId, duplicateId } = await readBody(req);
      if (!masterId || !duplicateId) return fail("masterId and duplicateId required", 400);
      if (masterId === duplicateId) return fail("masterId and duplicateId must be different", 400);

      const master    = await findById("inventory", masterId);
      const duplicate = await findById("inventory", duplicateId);
      if (!master)    return fail("master item not found", 404);
      if (!duplicate) return fail("duplicate item not found", 404);

      // Verify both belong to the same company and the user has access
      await assertCompanyAccess(user, master.companyId);
      if (master.companyId !== duplicate.companyId) return fail("Items belong to different companies", 400);

      // Merge: add duplicate's quantity into master
      const combinedQty = Number(master.quantity || 0) + Number(duplicate.quantity || 0);
      const updated = await update("inventory", masterId, { quantity: combinedQty });

      // Delete the duplicate
      await remove("inventory", duplicateId);

      return ok({ merged: updated, removedId: duplicateId });
    } catch (e) {
      return fail(e.message, e.status || 500);
    }
  });
}
