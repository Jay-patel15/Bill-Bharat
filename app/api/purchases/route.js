import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findById, findWhere, insert, update, query, transaction } from "@/lib/db";
import { computeInvoice, gstStateFromGstin, isGstCompany } from "@/lib/gst";
import { localDate } from "@/lib/utils";
import { addPayment, recordPurchaseAccounting, findStockFor } from "@/lib/accounting";
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
      await assertCompanyAccess(user, companyId);
      const company = await findById("companies", companyId);
      if (!company) return fail("Company not found", 404);

      const parse = purchaseSchema.safeParse(body);
      if (!parse.success) {
        return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
      }
      const data = parse.data;
      // Without a GSTIN no GST is claimed on purchases either: every rate is 0.
      if (!isGstCompany(company)) for (const it of data.items || []) it.gstRate = 0;

      const recipientStateCode = company.stateCode || gstStateFromGstin(company.gstNumber);
      const supplierStateCode = gstStateFromGstin(data.supplierGst) || recipientStateCode;
      const computed = computeInvoice({
        items: (data.items || []).map((i) => ({
          ...i,
          sellingPrice: Number(i.rate ?? i.purchasePrice ?? 0)
        })),
        supplierStateCode,
        recipientStateCode,
        invoiceDiscount: data.discount || 0
      });
      const paidNow = Number(data.amountPaid) || 0;
      const isDraft = data.status === "Draft";

      const saved = await transaction(async () => {
        const created = await insert("purchases", {
          companyId,
          supplierName: data.supplierName || "",
          supplierGst: data.supplierGst || "",
          billNumber: data.billNumber || "",
          billDate: data.billDate || localDate(),
          items: (data.items || []).map((it, i) => ({
            ...it,
            purchasePrice: Number(it.purchasePrice ?? it.rate ?? 0),
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
          amountPaid: 0,
          status: isDraft ? "Draft" : "Unpaid",
          notes: data.notes || "",
          pdfUrl: "",
          customerId: (body.customerId && body.customerId !== "null") ? body.customerId : null
        });

        for (const it of data.items || []) {
          if (!it.name) continue;
          const rate = Number(it.rate ?? it.purchasePrice ?? 0);
          const inv = await findStockFor(companyId, it);
          if (inv) {
            await update("inventory", inv.id, {
              quantity: Number(inv.quantity || 0) + Number(it.quantity || 0),
              purchasePrice: rate || Number(inv.purchasePrice || 0)
            }, user.id);
          } else if (body.autoCreateInventory !== false) {
            await insert("inventory", {
              companyId,
              name: it.name,
              sku: it.sku || "",
              category: it.category || "",
              hsnCode: it.hsnCode || "",
              unit: it.unit || "",
              purchasePrice: rate,
              sellingPrice: rate,
              gstRate: Number(it.gstRate || 0),
              quantity: Number(it.quantity || 0),
              lowStockThreshold: 0
            });
          }

          // Remember what the supplier calls this product, for the next AI-read bill.
          if (it.realName) {
            await query(
              `INSERT INTO product_mappings (id, "companyId", "realName", "systemName", "createdAt", "updatedAt")
               VALUES (lower(hex(randomblob(16))), $1, $2, $3, $4, $5)
               ON CONFLICT ("companyId", LOWER("realName")) DO UPDATE SET "systemName" = excluded."systemName", "updatedAt" = excluded."updatedAt"`,
              [companyId, it.realName, it.name, new Date().toISOString(), new Date().toISOString()]
            );
          }
        }

        if (isDraft) return created;
        await recordPurchaseAccounting(created);
        if (paidNow > 0) {
          return (await addPayment("PURCHASE", created, {
            amount: paidNow, date: created.billDate, notes: `Paid at billing, ${created.billNumber || "bill"}`
          })).doc;
        }
        return created;
      });

      return ok(saved);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
