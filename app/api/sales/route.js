import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findById, findOne, findWhere, insert, transaction, getSetting } from "@/lib/db";
import { checkConsumables, moveStock } from "@/lib/consumables";
import { mergeTemplate, templateKey } from "@/lib/invoice-template";
import { priceSale, syncSellingRates, quoteStatusFor, quoteToConvert, markConverted } from "@/lib/sales";
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
      // Saving a quotation as an invoice: the quotation is marked Converted in the same transaction below.
      const fromQuote = body.convertFromId ? await quoteToConvert(body.convertFromId, companyId) : null;
      if (fromQuote && docType.value !== "Tax Invoice") return fail("A quotation converts to a Tax Invoice", 400);
      const computed = priceSale({ company, customer, docType, items: data.items || [], discount: data.discount || 0 });

      for (const it of computed.items) {
        if (it.consumablesUsed.length && docType.value !== "Tax Invoice") return fail("Consumables are only recorded on a Tax Invoice", 400);
        it.consumablesUsed = await checkConsumables(companyId, it.inventoryId, it.consumablesUsed);
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
          amountPaid: docType.affectsOutstanding || docType.value === "Quotation" ? 0 : paidNow,
          status: docType.affectsOutstanding ? "Unpaid" : docType.value === "Quotation" ? quoteStatusFor(data.status) : (data.status || "Unpaid"),
          notes: finalNotes,
          pdfUrl: ""
        });

        if (fromQuote) await markConverted(fromQuote, created.id, user.id);
        if (docType.affectsStock) await moveStock(companyId, computed.items, -1, user.id);
        if (docType.value === "Tax Invoice") await syncSellingRates(companyId, computed.items, user.id);

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
