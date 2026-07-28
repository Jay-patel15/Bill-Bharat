import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findById, findWhere, insert } from "@/lib/db";
import { projectSchema } from "@/lib/validations";

function computeContractValue(boqItems = []) {
  return boqItems.reduce((sum, it) => {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.rate) || 0;
    return sum + qty * rate;
  }, 0);
}

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const items = await findWhere("projects", { companyId });
      items.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      });
      return ok(items);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function POST(req) {
  return withUser(async (user) => {
    try {
      const body = await readBody(req);
      const companyId = body.companyId || getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);

      const payload = { ...body, companyId };
      const parse = projectSchema.safeParse(payload);
      if (!parse.success) {
        return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
      }
      const data = parse.data;

      if (!data.customerId) return fail("Customer required", 400);
      const customer = await findById("customers", data.customerId);
      if (!customer || customer.companyId !== companyId) return fail("Invalid customer", 400);

      const boqItems = (data.boqItems || []).map((it) => ({
        name: it.name || "",
        description: it.description || "",
        hsnCode: it.hsnCode || "",
        quantity: Number(it.quantity) || 0,
        unit: it.unit || "PCS",
        rate: Number(it.rate) || 0,
        gstRate: Number(it.gstRate) || 0,
        amount: (Number(it.quantity) || 0) * (Number(it.rate) || 0)
      }));

      const created = await insert("projects", {
        companyId,
        customerId: data.customerId,
        name: data.name,
        code: data.code || "",
        description: data.description || "",
        boqItems,
        contractValue: data.contractValue ? Number(data.contractValue) : computeContractValue(boqItems),
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        status: data.status || "Active",
        notes: data.notes || ""
      });
      return ok(created);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
