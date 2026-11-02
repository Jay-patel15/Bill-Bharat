import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, getSetting, setSetting, deleteSetting } from "@/lib/db";
import { mergeTemplate, templateKey } from "@/lib/invoice-template";

async function companyOf(req, user) {
  const companyId = getCompanyIdFromRequest(req);
  await assertCompanyAccess(user, companyId);
  return companyId;
}

/** GET: this company's invoice template (defaults filled in). */
export async function GET(req) {
  return withUser(async (user) => {
    try {
      const raw = await getSetting(templateKey(await companyOf(req, user)));
      let saved = null;
      try { saved = JSON.parse(raw || "null"); } catch { /* corrupt: defaults */ }
      return ok({ template: mergeTemplate(saved), custom: Boolean(raw) });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

/** PUT: save. Unknown keys are dropped and values clamped by mergeTemplate. */
export async function PUT(req) {
  return withUser(async (user) => {
    try {
      const companyId = await companyOf(req, user);
      const template = mergeTemplate((await readBody(req)).template);
      await setSetting(templateKey(companyId), JSON.stringify(template));
      return ok({ template, custom: true });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

/** DELETE: reset to default. */
export async function DELETE(req) {
  return withUser(async (user) => {
    try {
      await deleteSetting(templateKey(await companyOf(req, user)));
      return ok({ template: mergeTemplate(null), custom: false });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
