import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, remove, update } from "@/lib/db";

async function loadProject(user, id) {
  const p = await findById("projects", id);
  if (!p) { const e = new Error("Not found"); e.status = 404; throw e; }
  await assertCompanyAccess(user, p.companyId);
  return p;
}

export async function GET(_req, { params }) {
  return withUser(async (user) => {
    try { return ok(await loadProject(user, params.id)); }
    catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function PUT(req, { params }) {
  return withUser(async (user) => {
    try {
      await loadProject(user, params.id);
      const body = await readBody(req);
      delete body.id; delete body.companyId; delete body.createdAt;
      if (Array.isArray(body.boqItems)) {
        body.boqItems = body.boqItems.map((it) => ({
          name: it.name || "",
          description: it.description || "",
          hsnCode: it.hsnCode || "",
          quantity: Number(it.quantity) || 0,
          unit: it.unit || "PCS",
          rate: Number(it.rate) || 0,
          gstRate: Number(it.gstRate) || 0,
          amount: (Number(it.quantity) || 0) * (Number(it.rate) || 0)
        }));
      }
      if (body.contractValue !== undefined) body.contractValue = Number(body.contractValue) || 0;
      if (body.startDate !== undefined) body.startDate = body.startDate || null;
      if (body.endDate !== undefined) body.endDate = body.endDate || null;
      const updated = await update("projects", params.id, body);
      return ok(updated);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function DELETE(_req, { params }) {
  return withUser(async (user) => {
    try {
      await loadProject(user, params.id);
      await remove("projects", params.id);
      return ok({ deleted: true });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
