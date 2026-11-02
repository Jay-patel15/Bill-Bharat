import { fail, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findById } from "@/lib/db";
import { generateOutstandingPdf } from "@/lib/pdf";
import { outstandingStatement, PARTIES } from "@/lib/outstanding";

/** GET /api/reports/outstanding/pdf?party=customers|suppliers&companyId=… */
export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const company = await findById("companies", companyId);
      if (!company) return fail("Company not found", 404);

      const party = new URL(req.url).searchParams.get("party") || "customers";
      if (!PARTIES[party]) return fail("party must be customers or suppliers", 400);
      const statement = await outstandingStatement(companyId, party);

      const pdf = generateOutstandingPdf({ company, ...statement, ...PARTIES[party] });
      return new Response(pdf, {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `inline; filename="outstanding-${party}.pdf"`
        }
      });
    } catch (e) {
      return fail(e.message, e.status || 500);
    }
  });
}
