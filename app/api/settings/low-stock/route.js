import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, setSetting } from "@/lib/db";
import { lowStockKey } from "@/lib/stock";
import { readLowStock } from "@/lib/low-stock";

async function companyOf(req, user) {
  const companyId = getCompanyIdFromRequest(req);
  await assertCompanyAccess(user, companyId);
  return companyId;
}

/** GET: { threshold } */
export async function GET(req) {
  return withUser(async (user) => {
    try { return ok({ threshold: await readLowStock(await companyOf(req, user)) }); }
    catch (e) { return fail(e.message, e.status || 500); }
  });
}

/** PUT { threshold }: a number of 0 or more. 0 turns the default alert off. */
export async function PUT(req) {
  return withUser(async (user) => {
    try {
      const companyId = await companyOf(req, user);
      const value = Number((await readBody(req)).threshold);
      if (!Number.isFinite(value) || value < 0) return fail("Enter a number of 0 or more", 400);
      await setSetting(lowStockKey(companyId), String(value));
      return ok({ threshold: value });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
