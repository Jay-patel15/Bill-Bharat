import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findById, findOne, findWhere, insert, update, transaction, getSetting } from "@/lib/db";
import { mergeTemplate, templateKey } from "@/lib/invoice-template";
import { computeInvoice, gstStateFromGstin } from "@/lib/gst";
import { getDocumentType, nextInvoiceNumber, formatInvoiceNotes, parseInvoiceNotes, localDate } from "@/lib/utils";
import { recordSaleAccounting, addPayment } from "@/lib/accounting";
import { saleSchema } from "@/lib/validations";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const sales = await findWhere("sales", { companyId });
      sales.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      return ok(sales);
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

      const parse = saleSchema.safeParse(body);
      if (!parse.success) {
        return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
      }
      const data = parse.data;

      const customer = await findById("customers", data.customerId);
      if (!customer || customer.companyId !== companyId) return fail("Invalid customer", 400);


      const docType = getDocumentType(data.documentType || "Tax Invoice");
      const supplierStateCode = company.stateCode || gstStateFromGstin(company.gstNumber);
      const recipientStateCode = customer.stateCode || gstStateFromGstin(customer.gstNumber) || supplierStateCode;

      // Compute totals; for non-taxable docs (Delivery Challan), strip the tax.
      const computed = computeInvoice({
        items: data.items || [],
        supplierStateCode,
        recipientStateCode,
        invoiceDiscount: data.discount || 0,
        roundToRupee: docType.taxable
      });
      if (!docType.taxable) {
        for (const it of computed.items) { it.cgst = it.sgst = it.igst = 0; it.total = it.taxable; }
        computed.cgst = computed.sgst = computed.igst = 0;
        computed.grandTotal = computed.subtotal;
      }

      const { notes: plainNotes, metadata: existingMeta } = parseInvoiceNotes(data.notes || "");
      const finalNotes = formatInvoiceNotes(plainNotes, existingMeta);
      const paidNow = Number(data.amountPaid) || 0;

      const saved = await transaction(async () => {
        // Number chosen inside the transaction so two saves can't pick the same one.
        let invoiceNumber = (data.invoiceNumber || "").trim();
        if (!invoiceNumber) {
          const allSales = await findWhere("sales", { companyId });
          let saved = null;
          try { saved = JSON.parse((await getSetting(templateKey(companyId))) || "null"); } catch { /* corrupt: default format */ }
          invoiceNumber = nextInvoiceNumber(allSales.map((s) => s.invoiceNumber), docType.prefix, mergeTemplate(saved).text.numberFormat, data.invoiceDate || localDate());
        } else if (await findOne("sales", { companyId, invoiceNumber })) {
          const e = new Error(`Number ${invoiceNumber} already exists for this company`);
          e.status = 409;
          throw e;
        }

        const created = await insert("sales", {
          companyId,
          customerId: customer.id,
          documentType: docType.value,
          invoiceNumber,
          invoiceDate: data.invoiceDate || localDate(),
          dueDate: data.dueDate || null,
          items: computed.items,
          subtotal: computed.subtotal,
          discount: computed.invoiceDiscount,
          cgst: computed.cgst,
          sgst: computed.sgst,
          igst: computed.igst,
          total: computed.grandTotal,
          // Bills take their paid amount from payment rows (below); other documents keep the figure as typed.
          amountPaid: docType.affectsOutstanding ? 0 : paidNow,
          status: docType.affectsOutstanding ? "Unpaid" : (data.status || "Unpaid"),
          notes: finalNotes,
          pdfUrl: ""
        });

        if (docType.affectsStock) {
          for (const it of computed.items) {
            if (!it.inventoryId) continue;
            const inv = await findById("inventory", it.inventoryId);
            if (inv && inv.companyId === companyId) {
              // Negative stock is allowed and shown, as in Tally; clamping to 0 loses the shortfall.
              await update("inventory", inv.id, { quantity: Number(inv.quantity || 0) - Number(it.quantity || 0) }, user.id);
            }
          }
        }

        if (!docType.affectsOutstanding) return created;
        await recordSaleAccounting(created, customer.name);
        if (paidNow > 0) {
          return (await addPayment("SALE", created, {
            amount: paidNow, date: created.invoiceDate, notes: `Paid at billing, ${invoiceNumber}`
          })).doc;
        }
        return created;
      });

      return ok(saved);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
