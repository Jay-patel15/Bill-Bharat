import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, getSetting, setSetting, deleteSetting } from "@/lib/db";
import { mergeTemplate, quotationTemplateKey, templateKey } from "@/lib/invoice-template";

async function companyOf(req, user) {
  const companyId = getCompanyIdFromRequest(req);
  await assertCompanyAccess(user, companyId);
  return companyId;
}

/** ?type=quotation picks the quotation style; anything else is the tax invoice style. */
function keyFor(req, companyId) {
  return new URL(req.url).searchParams.get("type") === "quotation" ? quotationTemplateKey(companyId) : templateKey(companyId);
}

/** GET: this company's template for the chosen document type (defaults filled in). */
export async function GET(req) {
  return withUser(async (user) => {
    try {
      const raw = await getSetting(keyFor(req, await companyOf(req, user)));
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
      await setSetting(keyFor(req, companyId), JSON.stringify(template));
      return ok({ template, custom: true });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

/** DELETE: reset the chosen document type to default. */
export async function DELETE(req) {
  return withUser(async (user) => {
    try {
      await deleteSetting(keyFor(req, await companyOf(req, user)));
      return ok({ template: mergeTemplate(null), custom: false });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
