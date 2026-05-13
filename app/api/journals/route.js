import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest } from "@/lib/db";
import { findWhere } from "@/lib/db";
import { recordJournalEntry } from "@/lib/accounting";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const journals = await findWhere("journal_entries", (j) => j.companyId === companyId);
      journals.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return ok(journals);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function POST(req) {
  return withUser(async (user) => {
    try {
      const body = await readBody(req);
      const companyId = body.companyId || getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);

      if (!body.entries || !Array.isArray(body.entries) || body.entries.length < 2) {
        return fail("Journal must have at least two entries (Debit and Credit)", 400);
      }

      const journal = await recordJournalEntry(companyId, {
        date: body.date,
        description: body.description || "",
        entries: body.entries
      });

      return ok(journal);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
