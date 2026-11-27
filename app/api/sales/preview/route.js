import { fail, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, getCompanyIdFromRequest, getSetting } from "@/lib/db";
import { generateInvoicePdf } from "@/lib/pdf";
import { priceSale } from "@/lib/sales";
import { loadLogo } from "@/lib/company-logo";
import { templateKeyFor } from "@/lib/invoice-template";
import { getDocumentType, localDate, parseInvoiceNotes } from "@/lib/utils";
import { saleSchema } from "@/lib/validations";

/** The PDF of a bill as it is being typed, built the same way as a saved one. Nothing is saved. */
export async function POST(req) {
  return withUser(async (user) => {
    try {
      const body = await readBody(req);
      const companyId = body.companyId || getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const company = await findById("companies", companyId);
      if (!company) return fail("Company not found", 404);

      const parse = saleSchema.safeParse(body);
      if (!parse.success) return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
      const data = parse.data;
      const customer = await findById("customers", data.customerId);
      if (!customer || customer.companyId !== companyId) return fail("Invalid customer", 400);

      const docType = getDocumentType(data.documentType || "Tax Invoice");
      const computed = priceSale({ company, customer, docType, items: data.items, discount: data.discount || 0 });
      const { notes: plain, metadata } = parseInvoiceNotes(data.notes || "");
      let template = null;
      try { template = JSON.parse((await getSetting(templateKeyFor(docType.value, companyId))) || "null"); } catch { /* corrupt: defaults */ }

      const pdf = generateInvoicePdf({
        company,
        customer,
        title: docType.pdfTitle,
        template,
        logo: loadLogo(company.logoUrl),
        invoice: {
          invoiceNumber: (data.invoiceNumber || "").trim() || "DRAFT",
          invoiceDate: data.invoiceDate || localDate(),
          dueDate: data.dueDate || null,
          items: computed.items,
          subtotal: computed.subtotal,
          cgst: computed.cgst,
          sgst: computed.sgst,
          igst: computed.igst,
          invoiceDiscount: computed.invoiceDiscount,
          grandTotal: computed.grandTotal,
          notes: plain,
          metadata
        }
      });
      return new Response(pdf, { headers: { "content-type": "application/pdf" } });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
