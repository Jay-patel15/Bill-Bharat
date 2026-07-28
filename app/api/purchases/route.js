import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest } from "@/lib/db";
import { findOne, findWhere, insert, update } from "@/lib/db";
import { computeInvoice, gstStateFromGstin } from "@/lib/gst";
import { purchaseSchema } from "@/lib/validations";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const purchases = await findWhere("purchases", { companyId });
      purchases.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      return ok(purchases);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function POST(req) {
  return withUser(async (user) => {
    try {
      const body = await readBody(req);
      const companyId = body.companyId || getCompanyIdFromRequest(req);
      const company = await assertCompanyAccess(user, companyId);

      const parse = purchaseSchema.safeParse(body);
      if (!parse.success) {
        return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
      }
      const data = parse.data;

      const supplierStateCode = gstStateFromGstin(data.supplierGst) || company.stateCode;
      const recipientStateCode = company.stateCode || gstStateFromGstin(company.gstNumber);
      const computed = computeInvoice({
        items: (data.items || []).map((i) => ({
          ...i,
          sellingPrice: Number(i.rate || i.purchasePrice || 0)
        })),
        supplierStateCode,
        recipientStateCode
      });

      const status = data.status || (Number(data.amountPaid) >= computed.grandTotal ? "Paid" : (Number(data.amountPaid) > 0 ? "Partially Paid" : "Unpaid"));

      const created = await insert("purchases", {
        companyId,
        supplierName: data.supplierName || "",
        supplierGst: data.supplierGst || "",
        billNumber: data.billNumber || "",
        billDate: data.billDate || new Date().toISOString().slice(0, 10),
        items: (data.items || []).map((it, i) => ({
          ...it,
          purchasePrice: Number(it.rate || 0),
          quantity: Number(it.quantity || 0),
          gstRate: Number(it.gstRate || 0),
          taxable: computed.items[i]?.taxable,
          cgst: computed.items[i]?.cgst,
          sgst: computed.items[i]?.sgst,
          igst: computed.items[i]?.igst,
          total: computed.items[i]?.total
        })),
        subtotal: computed.subtotal,
        cgst: computed.cgst,
        sgst: computed.sgst,
        igst: computed.igst,
        total: computed.grandTotal,
        amountPaid: Number(data.amountPaid) || 0,
        status,
        notes: data.notes || "",
        pdfUrl: "",
        customerId: (body.customerId && body.customerId !== "null") ? body.customerId : null
      });

      // Increase inventory: match by sku else by name
      for (const it of data.items || []) {
        if (!it.name) continue;

        let inv = null;
        if (it.sku) inv = await findOne("inventory", { companyId, sku: it.sku });
        if (!inv) inv = await findOne("inventory", { companyId, name: it.name });
        
        if (inv) {
          await update("inventory", inv.id, {
            quantity: Number(inv.quantity || 0) + Number(it.quantity || 0),
            purchasePrice: Number(it.rate || inv.purchasePrice || 0)
          }, user.id);
        } else if (body.autoCreateInventory !== false) {
          await insert("inventory", {
            companyId,
            name: it.name,
            sku: it.sku || "",
            category: it.category || "",
            hsnCode: it.hsnCode || "",
            unit: it.unit || "",
            purchasePrice: Number(it.rate || 0),
            sellingPrice: Number(it.rate || 0),
            gstRate: Number(it.gstRate || 0),
            quantity: Number(it.quantity || 0),
            lowStockThreshold: 0
          });
        }
      }

      return ok(created);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
