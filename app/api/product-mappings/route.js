import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findWhere, insert } from "@/lib/db";
import { productMappingSchema } from "@/lib/validations";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const list = await findWhere("product_mappings", { companyId });
      return ok(list);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function POST(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const body = await readBody(req);

      if (Array.isArray(body.items)) {
        const created = [];
        for (const item of body.items) {
          const realName = typeof item === "string" ? item : item.realName;
          const systemName = typeof item === "string" ? item : (item.systemName || item.realName);
          if (!realName || !realName.trim()) continue;
          const parse = productMappingSchema.safeParse({
            companyId,
            realName: realName.trim(),
            systemName: systemName ? systemName.trim() : realName.trim()
          });
          if (parse.success) {
            const c = await insert("product_mappings", {
              ...parse.data,
              systemName: parse.data.systemName || parse.data.realName
            });
            created.push(c);
          }
        }
        return ok(created);
      }

      const realName = (body.realName || "").trim();
      const systemName = (body.systemName || realName).trim();

      const parse = productMappingSchema.safeParse({
        companyId,
        realName,
        systemName
      });

      if (!parse.success) {
        return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
      }

      const created = await insert("product_mappings", {
        ...parse.data,
        systemName: parse.data.systemName || parse.data.realName
      });

      return ok(created);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
