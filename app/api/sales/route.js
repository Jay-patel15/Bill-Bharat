import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest } from "@/lib/db";
import { findById, findWhere, insert, update } from "@/lib/db";
import { computeInvoice, gstStateFromGstin } from "@/lib/gst";
import { getDocumentType, nextInvoiceNumber, formatInvoiceNotes, parseInvoiceNotes } from "@/lib/utils";
import { recordSaleAccounting } from "@/lib/accounting";
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
      const company = await assertCompanyAccess(user, companyId);

      const parse = saleSchema.safeParse(body);
      if (!parse.success) {
        return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
      }
      const data = parse.data;

      const customer = await findById("customers", data.customerId);
      if (!customer || customer.companyId !== companyId) return fail("Invalid customer", 400);

      let projectId = null;
      let projectName = data.projectName || "";
      if (data.projectId && data.projectId !== "null" && data.projectId !== "custom") {
        const project = await findById("projects", data.projectId);
        if (!project || project.companyId !== companyId) return fail("Invalid project", 400);
        if (project.customerId && project.customerId !== data.customerId) {
          return fail("Project belongs to a different customer", 400);
        }
        projectId = project.id;
        projectName = project.name;
      }

      const docType = getDocumentType(data.documentType || "Tax Invoice");
      const supplierStateCode = company.stateCode || gstStateFromGstin(company.gstNumber);
      const recipientStateCode = customer.stateCode || gstStateFromGstin(customer.gstNumber) || supplierStateCode;

      // Compute totals; for non-taxable docs (Delivery Challan), strip the tax.
      const computed = computeInvoice({
        items: data.items || [],
        supplierStateCode,
        recipientStateCode,
        invoiceDiscount: data.discount || 0
      });
      if (!docType.taxable) {
        for (const it of computed.items) { it.cgst = it.sgst = it.igst = 0; it.total = it.taxable; }
        computed.cgst = computed.sgst = computed.igst = 0;
        computed.grandTotal = computed.subtotal - (Number(data.discount) || 0);
      }

      // Invoice number — user-supplied or auto-generated using doc-type prefix
      let invoiceNumber = (data.invoiceNumber || "").trim();
      const allSales = await findWhere("sales", { companyId });
      if (!invoiceNumber) {
        invoiceNumber = nextInvoiceNumber(allSales.map((s) => s.invoiceNumber), docType.prefix);
      } else {
        // Reject duplicates within the same company
        const dup = allSales.find((s) => s.invoiceNumber === invoiceNumber);
        if (dup) return fail(`Number ${invoiceNumber} already exists for this company`, 409);
      }

      const status = data.status || (Number(data.amountPaid) >= computed.grandTotal ? "Paid" : (Number(data.amountPaid) > 0 ? "Partially Paid" : "Unpaid"));

      const { notes: plainNotes, metadata: existingMeta } = parseInvoiceNotes(data.notes || "");
      if (projectName) existingMeta.projectName = projectName;
      const finalNotes = formatInvoiceNotes(plainNotes, existingMeta);

      const created = await insert("sales", {
        companyId,
        customerId: customer.id,
        projectId,
        documentType: docType.value,
        invoiceNumber,
        invoiceDate: data.invoiceDate || new Date().toISOString().slice(0, 10),
        dueDate: data.dueDate || null,
        items: computed.items,
        subtotal: computed.subtotal,
        discount: computed.invoiceDiscount,
        cgst: computed.cgst,
        sgst: computed.sgst,
        igst: computed.igst,
        total: computed.grandTotal,
        amountPaid: Number(data.amountPaid) || 0,
        status,
        notes: finalNotes,
        pdfUrl: ""
      });

      // Inventory side-effects only for docs that actually move stock
      if (docType.affectsStock) {
        for (const it of computed.items) {
          if (it.inventoryId) {
            const inv = await findById("inventory", it.inventoryId);
            if (inv && inv.companyId === companyId) {
              const newQty = Math.max(0, Number(inv.quantity || 0) - Number(it.quantity || 0));
              await update("inventory", inv.id, { quantity: newQty }, user.id);
            }
          }
        }
      }

      // Outstanding only for docs that are real bills
      if (docType.affectsOutstanding) {
        const outstanding = Number(customer.outstanding || 0) + (computed.grandTotal - (Number(data.amountPaid) || 0));
        await update("customers", customer.id, { outstanding }, user.id);
      }

      // Accounting Ledger (Double-Entry)
      if (docType.affectsOutstanding) {
        await recordSaleAccounting(created, customer.name);
      }

      return ok(created);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
