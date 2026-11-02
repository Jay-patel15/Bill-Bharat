import { fail, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findById } from "@/lib/db";
import { generateStatementPdf } from "@/lib/pdf";
import { partyStatement, PARTIES } from "@/lib/outstanding";

/** GET /api/reports/ledger/pdf?party=…&key=…&from=…&to=…&ids=…&companyId=… */
export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const company = await findById("companies", companyId);
      if (!company) return fail("Company not found", 404);

      const q = new URL(req.url).searchParams;
      const party = q.get("party") || "customers";
      if (!PARTIES[party]) return fail("party must be customers or suppliers", 400);
      const statement = await partyStatement(companyId, party, q.get("key") || "", q.get("from") || "", q.get("to") || "", (q.get("ids") || "").split(",").filter(Boolean));
      if (!statement) return fail("No bills found for this party", 404);

      const safe = statement.name.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 40);
      return new Response(generateStatementPdf({ company, statement }), {
        headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="statement-${safe}.pdf"` }
      });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
