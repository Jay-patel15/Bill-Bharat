import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest } from "@/lib/db";
import { findById, findWhere, insert } from "@/lib/db";

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
      const items = await findWhere("projects", (p) => p.companyId === companyId);
      items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
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
      if (!body.name) return fail("Project name required", 400);
      if (!body.customerId) return fail("Customer required", 400);
      const customer = await findById("customers", body.customerId);
      if (!customer || customer.companyId !== companyId) return fail("Invalid customer", 400);

      const boqItems = (body.boqItems || []).map((it) => ({
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
        customerId: body.customerId,
        name: body.name,
        code: body.code || "",
        description: body.description || "",
        boqItems,
        contractValue: body.contractValue !== undefined && body.contractValue !== ""
          ? Number(body.contractValue)
          : computeContractValue(boqItems),
        startDate: body.startDate || null,
        endDate: body.endDate || null,
        status: body.status || "Active",
        notes: body.notes || ""
      });
      return ok(created);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

