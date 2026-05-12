import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest } from "@/lib/db";
import { findById, findOne, findWhere, insert, update } from "@/lib/google/sheets";
import { computeInvoice, gstStateFromGstin } from "@/lib/gst";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const purchases = await findWhere("purchases", (p) => p.companyId === companyId);
      purchases.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
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

      const supplierStateCode = gstStateFromGstin(body.supplierGst) || company.stateCode;
      const recipientStateCode = company.stateCode || gstStateFromGstin(company.gstNumber);
      const computed = computeInvoice({
        items: (body.items || []).map((i) => ({
          ...i,
          sellingPrice: Number(i.purchasePrice || i.price || 0)
        })),
        supplierStateCode,
        recipientStateCode
      });

      const status = body.status || (Number(body.amountPaid) >= computed.grandTotal ? "Paid" : (Number(body.amountPaid) > 0 ? "Partially Paid" : "Unpaid"));

      const created = await insert("purchases", {
        companyId,
        supplierName: body.supplierName || "",
        supplierGst: body.supplierGst || "",
        billNumber: body.billNumber || "",
        billDate: body.billDate || new Date().toISOString().slice(0, 10),
        items: (body.items || []).map((it, i) => ({
          ...it,
          purchasePrice: Number(it.purchasePrice || it.price || 0),
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
        amountPaid: Number(body.amountPaid) || 0,
        status,
        notes: body.notes || "",
        pdfUrl: body.pdfUrl || "",
        customerId: body.customerId || ""
      });

      // Increase inventory: match by sku else by name
      for (const it of body.items || []) {
        if (!it.name) continue;

        // 1. Handle Product Mapping if realName is different from name
        if (it.realName && it.realName.toLowerCase() !== it.name.toLowerCase()) {
          const mapping = await findOne("product_mappings", (m) => 
            m.companyId === companyId && m.realName?.toLowerCase() === it.realName.toLowerCase()
          );
          if (!mapping) {
            await insert("product_mappings", {
              companyId,
              realName: it.realName,
              systemName: it.name
            });
          } else if (mapping.systemName !== it.name) {
            await update("product_mappings", mapping.id, { systemName: it.name });
          }
        }

        // 2. Update / Create Inventory
        let inv = null;
        if (it.sku) inv = await findOne("inventory", (i) => i.companyId === companyId && i.sku === it.sku);
        if (!inv) inv = await findOne("inventory", (i) => i.companyId === companyId && i.name?.toLowerCase() === it.name.toLowerCase());
        
        if (inv) {
          await update("inventory", inv.id, {
            quantity: Number(inv.quantity || 0) + Number(it.quantity || 0),
            purchasePrice: Number(it.purchasePrice || inv.purchasePrice || 0)
          });
        } else if (body.autoCreateInventory !== false) {
          await insert("inventory", {
            companyId,
            name: it.name,
            sku: it.sku || "",
            category: it.category || "",
            hsnCode: it.hsnCode || "",
            unit: it.unit || "",
            purchasePrice: Number(it.purchasePrice || 0),
            sellingPrice: Number(it.sellingPrice || it.purchasePrice || 0),
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
