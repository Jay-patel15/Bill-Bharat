import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findWhere } from "@/lib/db";
import { recordJournalEntry } from "@/lib/accounting";
import { journalEntrySchema } from "@/lib/validations";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const journals = await findWhere("journal_entries", { companyId });
      journals.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
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

      const parse = journalEntrySchema.safeParse({ ...body, companyId });
      if (!parse.success) {
        return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
      }
      const data = parse.data;

      if (data.entries.length < 2) {
        return fail("Journal must have at least two entries (Debit and Credit)", 400);
      }

      const journal = await recordJournalEntry(companyId, {
        date: data.date,
        description: data.description || "",
        entries: data.entries
      });

      return ok(journal);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
