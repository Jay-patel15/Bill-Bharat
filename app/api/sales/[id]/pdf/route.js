import { fail, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, update } from "@/lib/db";
import { generateInvoicePdf } from "@/lib/pdf";
import { uploadFile } from "@/lib/storage/local";
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

      let project = null;
      if (sale.projectId) {
        project = await findById("projects", sale.projectId);
      }

      const items = typeof sale.items === "string" ? JSON.parse(sale.items || "[]") : (sale.items || []);
      const interstate = Number(sale.igst || 0) > 0;
      const docType = getDocumentType(sale.documentType || "Tax Invoice");

      const { notes: plainNotes, metadata } = parseInvoiceNotes(sale.notes);

      const pdfBuffer = generateInvoicePdf({
        company,
        customer,
        project,
        title: docType.pdfTitle,
        showTax: docType.value !== "Delivery Challan",
        invoice: {
          invoiceNumber: sale.invoiceNumber,
          invoiceDate: sale.invoiceDate,
          dueDate: sale.dueDate,
          projectName: project?.name || sale.projectName || metadata?.projectName || "",
          interstate,
          items,
          subtotal: Number(sale.subtotal),
          cgst: Number(sale.cgst),
          sgst: Number(sale.sgst),
          igst: Number(sale.igst),
          invoiceDiscount: Number(sale.discount),
          roundOff: 0,
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
          "content-disposition": `inline; filename="${sale.invoiceNumber}.pdf"`
        }
      });
    } catch (e) {
      return fail(e.message, e.status || 500);
    }
  });
}
