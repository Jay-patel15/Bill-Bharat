import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, findWhere, remove, update, query, transaction } from "@/lib/db";
import { addPayment, recordPurchaseAccounting, removeDocumentEntries, findStockFor } from "@/lib/accounting";

async function loadPurchase(user, id) {
  const p = await findById("purchases", id);
  if (!p) { const e = new Error("Not found"); e.status = 404; throw e; }
  await assertCompanyAccess(user, p.companyId);
  return p;
}

async function withPayments(p) {
  const payments = await findWhere("payments", { refId: p.id, type: "PURCHASE" });
  return { ...p, payments: payments.sort((a, b) => new Date(b.date) - new Date(a.date)) };
}

export async function GET(_req, { params }) {
  return withUser(async (user) => {
    try { return ok(await withPayments(await loadPurchase(user, params.id))); }
    catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function PUT(req, { params }) {
  return withUser(async (user) => {
    try {
      const p = await loadPurchase(user, params.id);
      const body = await readBody(req);
      const patch = {};
      for (const k of ["status", "notes", "pdfUrl", "customerId"]) if (body[k] !== undefined) patch[k] = body[k];
      if (patch.customerId !== undefined) {
        patch.customerId = (patch.customerId && patch.customerId !== "null") ? patch.customerId : null;
      }

      const updated = await transaction(async () => {
        let row = Object.keys(patch).length ? await update("purchases", p.id, patch, user.id) : p;
        // Approving a draft posts the bill to the books.
        if (p.status === "Draft" && row.status !== "Draft") {
          const posted = await query(`SELECT 1 AS x FROM ledger_entries WHERE "refId" = $1 LIMIT 1`, [p.id]);
          if (!posted.length) await recordPurchaseAccounting(row);
        }
        if (body.amountPaid !== undefined) {
          const diff = Number(body.amountPaid) - Number(p.amountPaid || 0);
          if (!Number.isFinite(diff)) { const e = new Error("Invalid amountPaid"); e.status = 400; throw e; }
          if (diff !== 0) {
            row = (await addPayment("PURCHASE", row, {
              amount: diff,
              method: body.paymentMethod,
              notes: body.paymentNotes || `Payment for bill ${p.billNumber}`
            })).doc;
          }
        }
        return row;
      });
      return ok(await withPayments(updated));
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function DELETE(_req, { params }) {
  return withUser(async (user) => {
    try {
      const p = await loadPurchase(user, params.id);
      await transaction(async () => {
        // Take back the stock this bill added (matched the same way POST matched it).
        for (const it of p.items || []) {
          const inv = await findStockFor(p.companyId, it);
          if (inv) await update("inventory", inv.id, { quantity: Number(inv.quantity || 0) - Number(it.quantity || 0) }, user.id);
        }
        await removeDocumentEntries("PURCHASE", p.id);
        await remove("purchases", p.id, user.id);
      });
      return ok({ deleted: true });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
