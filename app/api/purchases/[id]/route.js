import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, remove, update } from "@/lib/db";

async function loadPurchase(user, id) {
  const p = await findById("purchases", id);
  if (!p) { const e = new Error("Not found"); e.status = 404; throw e; }
  await assertCompanyAccess(user, p.companyId);
  return p;
}

export async function GET(_req, { params }) {
  return withUser(async (user) => {
    try {
      const { findWhere } = await import("@/lib/db");
      const p = await loadPurchase(user, params.id);
      const payments = await findWhere("payments", (pay) => pay.refId === p.id && pay.type === "PURCHASE");
      return ok({ ...p, payments: (payments || []).sort((a, b) => new Date(b.date) - new Date(a.date)) });
    }
    catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function PUT(req, { params }) {
  return withUser(async (user) => {
    try {
      const p = await loadPurchase(user, params.id);
      const body = await readBody(req);
      const allowed = ["status", "amountPaid", "notes", "pdfUrl", "customerId"];
      const patch = {};
      for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k];
      if (patch.amountPaid !== undefined) patch.amountPaid = Number(patch.amountPaid);
      if (patch.customerId !== undefined) {
        patch.customerId = (patch.customerId && patch.customerId !== "null") ? patch.customerId : null;
      }

      // Record payment if amount changed
      if (patch.amountPaid !== undefined) {
        const diff = patch.amountPaid - Number(p.amountPaid || 0);
        if (diff !== 0) {
          const { insert } = await import("@/lib/db");
          await insert("payments", {
            companyId: p.companyId,
            type: "PURCHASE",
            refId: p.id,
            amount: diff,
            method: body.paymentMethod || "Cash",
            date: new Date().toISOString(),
            notes: body.paymentNotes || `Payment for bill ${p.billNumber}`
          });
        }
      }

      const updated = await update("purchases", params.id, patch);
      const { findWhere } = await import("@/lib/db");
      const payments = await findWhere("payments", (pay) => pay.refId === p.id && pay.type === "PURCHASE");
      return ok({ ...updated, payments: (payments || []).sort((a, b) => new Date(b.date) - new Date(a.date)) });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function DELETE(_req, { params }) {
  return withUser(async (user) => {
    try {
      await loadPurchase(user, params.id);
      await remove("purchases", params.id);
      return ok({ deleted: true });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
