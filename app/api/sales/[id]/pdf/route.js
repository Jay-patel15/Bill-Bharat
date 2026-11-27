import { fail, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, getSetting, update } from "@/lib/db";
import { generateInvoicePdf } from "@/lib/pdf";
import { uploadFile } from "@/lib/storage/local";
import { templateKeyFor } from "@/lib/invoice-template";
import { loadLogo } from "@/lib/company-logo";
import { getDocumentType, parseInvoiceNotes } from "@/lib/utils";

export async function GET(req, { params }) {
  return withUser(async (user) => {
    try {
      const sale = await findById("sales", params.id);
      if (!sale) return fail("Not found", 404);
      await assertCompanyAccess(user, sale.companyId);
      const company = await findById("companies", sale.companyId);
      const customer = await findById("customers", sale.customerId);
      if (!customer) return fail("Customer missing", 400);

      const items = sale.items || [];
      const docType = getDocumentType(sale.documentType || "Tax Invoice");
      let template = null;
      try { template = JSON.parse((await getSetting(templateKeyFor(docType.value, sale.companyId))) || "null"); } catch { /* corrupt: defaults */ }

      const { notes: plainNotes, metadata } = parseInvoiceNotes(sale.notes);

      const pdfBuffer = generateInvoicePdf({
        company,
        customer,
        title: docType.pdfTitle,
        template,
        logo: loadLogo(company.logoUrl),
        invoice: {
          invoiceNumber: sale.invoiceNumber,
          invoiceDate: sale.invoiceDate,
          dueDate: sale.dueDate,
          projectName: sale.projectName || metadata?.projectName || "", // site name saved on older bills
          items,
          subtotal: Number(sale.subtotal),
          cgst: Number(sale.cgst),
          sgst: Number(sale.sgst),
          igst: Number(sale.igst),
          invoiceDiscount: Number(sale.discount),
          grandTotal: Number(sale.total),
          notes: plainNotes,
          metadata
        }
      });

      const url = new URL(req.url);
      const saveRequested = url.searchParams.get("save") === "1" || url.searchParams.get("drive") === "1";

      let fileUrl = sale.pdfUrl || "";

      if (saveRequested || !sale.pdfUrl) {
        try {
          const saved = await uploadFile({
            data: pdfBuffer,
            filename: `${sale.invoiceNumber || sale.id}.pdf`,
            mimeType: "application/pdf",
            subfolder: "invoices"
          });
          fileUrl = saved.viewUrl;
          await update("sales", sale.id, { pdfUrl: fileUrl });
        } catch (saveErr) {
          // A failed archive copy must not block viewing the PDF.
          console.error("PDF save error:", saveErr.message);
          if (saveRequested) return fail(saveErr.message || "Could not save PDF", 500);
        }
      }

      if (saveRequested) {
        return new Response(JSON.stringify({ ok: true, pdfUrl: fileUrl, message: "PDF saved" }), {
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(pdfBuffer, {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `inline; filename="${String(sale.invoiceNumber).replace(/[\\/:*?"<>|]/g, "-")}.pdf"`
        }
      });
    } catch (e) {
      return fail(e.message, e.status || 500);
    }
  });
}
