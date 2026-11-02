import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest } from "@/lib/db";
import { partiesWithBills, partyStatement, PARTIES } from "@/lib/outstanding";

/**
 * GET /api/reports/ledger?party=customers|suppliers            → parties with bills
 * GET /api/reports/ledger?party=…&key=…&from=YYYY-MM-DD&to=…&ids=a,b → that party's ledger (ids: chosen bills, optional)
 */
export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const q = new URL(req.url).searchParams;
      const party = q.get("party") || "customers";
      if (!PARTIES[party]) return fail("party must be customers or suppliers", 400);
      const key = q.get("key");
      if (!key) return ok(await partiesWithBills(companyId, party));

      const statement = await partyStatement(companyId, party, key, q.get("from") || "", q.get("to") || "", (q.get("ids") || "").split(",").filter(Boolean));
      return statement ? ok(statement) : fail("No bills found for this party", 404);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
