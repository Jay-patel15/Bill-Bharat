import { computeInvoice, gstStateFromGstin, isGstCompany } from "./gst.js";
import { findById, query, transaction, update } from "./db.js";
import { addPayment, recalcPaid, recordSaleAccounting } from "./accounting.js";
import { checkConsumables, moveStock } from "./consumables.js";
import { formatInvoiceNotes, getDocumentType, parseInvoiceNotes, QUOTE_STATUSES } from "./utils.js";
import { saleSchema } from "./validations.js";

/** Totals for a sale's lines, shared by create and edit. Non-taxable documents (Delivery Challan) carry no tax. */
export function priceSale({ company, customer, docType, items, discount = 0 }) {
  const supplierStateCode = company.stateCode || gstStateFromGstin(company.gstNumber);
  const recipientStateCode = customer.stateCode || gstStateFromGstin(customer.gstNumber) || supplierStateCode;
  // Without a GSTIN the company bills without GST, whatever rate the line carries.
  const lines = isGstCompany(company) ? items : items.map((it) => ({ ...it, gstRate: 0 }));
  const computed = computeInvoice({
    items: lines,
    supplierStateCode,
    recipientStateCode,
    invoiceDiscount: discount,
    roundToRupee: docType.taxable
  });
  if (!docType.taxable) {
    for (const it of computed.items) { it.cgst = it.sgst = it.igst = 0; it.total = it.taxable; }
    computed.cgst = computed.sgst = computed.igst = 0;
    computed.grandTotal = computed.subtotal;
  }
  return computed;
}

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/** Status for a new quotation: a hand-set one, otherwise Draft. */
export function quoteStatusFor(status) {
  return QUOTE_STATUSES.includes(status) ? status : "Draft";
}

/** A quotation's status is set by hand until it is converted. Returns the status when it is allowed. */
export function checkQuoteStatus(sale, status) {
  if (sale.status === "Converted") throw httpError("This quotation is already converted to an invoice", 400);
  if (!QUOTE_STATUSES.includes(status)) throw httpError(`Status must be ${QUOTE_STATUSES.join(", ")}`, 400);
  return status;
}

/** The quotation a new invoice is made from. It must be an open quotation of this company. */
export async function quoteToConvert(id, companyId) {
  const quote = await findById("sales", id);
  if (!quote || quote.companyId !== companyId || quote.documentType !== "Quotation") throw httpError("Quotation not found", 400);
  if (quote.status === "Converted") throw httpError("This quotation is already converted to an invoice", 409);
  return quote;
}

/** Marks a quotation as converted into the invoice just saved. Call inside the transaction. */
export function markConverted(quote, invoiceId, userId) {
  return update("sales", quote.id, { status: "Converted", convertedToId: invoiceId }, userId);
}

/**
 * A Tax Invoice's line rate becomes the item's selling rate in stock. Only a rate above zero is copied,
 * so a blank or zero line never wipes the list price. Call inside the transaction.
 */
export async function syncSellingRates(companyId, items, userId) {
  for (const it of items) {
    const price = Number(it.sellingPrice) || 0;
    if (!it.inventoryId || !(price > 0)) continue;
    const inv = await findById("inventory", it.inventoryId);
    if (!inv || inv.companyId !== companyId) continue;
    if (Number(inv.sellingPrice) !== price) await update("inventory", inv.id, { sellingPrice: price }, userId);
  }
}

/**
 * Full edit of a document's lines. Undoes the old lines' stock and ledger
 * effects, saves the new lines, then applies them again. Payments keep their
 * own ledger lines. Customer and invoice number do not change.
 */
export async function editSale(user, sale, body) {
  const docType = getDocumentType(sale.documentType);
  if (sale.status === "Converted") throw httpError("This quotation is already converted to an invoice. Edit the invoice instead", 400);
  // Only unpaid invoices can be edited; payments are tied to the total they were received against.
  if (docType.affectsOutstanding && Number(sale.amountPaid) > 0) {
    throw httpError("This invoice has payments. Only unpaid invoices can be edited", 400);
  }

  const parse = saleSchema.safeParse({ ...body, customerId: sale.customerId, companyId: sale.companyId });
  if (!parse.success) throw httpError(parse.error.errors[0]?.message || "Invalid payload", 400);
  const data = parse.data;

  const company = await findById("companies", sale.companyId);
  const customer = await findById("customers", sale.customerId);
  if (!company || !customer) throw httpError("Customer or company not found", 400);

  const computed = priceSale({ company, customer, docType, items: data.items, discount: data.discount || 0 });
  for (const it of computed.items) {
    if (it.consumablesUsed.length && docType.value !== "Tax Invoice") throw httpError("Consumables are only recorded on a Tax Invoice", 400);
    it.consumablesUsed = await checkConsumables(sale.companyId, it.inventoryId, it.consumablesUsed);
  }

  const { notes: plainNotes, metadata } = parseInvoiceNotes(data.notes || "");

  return transaction(async () => {
    if (docType.affectsStock) await moveStock(sale.companyId, sale.items, 1, user.id);
    await query(`DELETE FROM ledger_entries WHERE "refId" = $1`, [sale.id]);

    let row = await update("sales", sale.id, {
      invoiceDate: data.invoiceDate || sale.invoiceDate,
      dueDate: data.dueDate || null,
      items: computed.items,
      subtotal: computed.subtotal,
      discount: computed.invoiceDiscount,
      cgst: computed.cgst,
      sgst: computed.sgst,
      igst: computed.igst,
      total: computed.grandTotal,
      notes: formatInvoiceNotes(plainNotes, metadata)
    }, user.id);

    if (docType.affectsStock) await moveStock(sale.companyId, computed.items, -1, user.id);
    if (docType.value === "Tax Invoice") await syncSellingRates(sale.companyId, computed.items, user.id);
    if (docType.affectsOutstanding) {
      await recordSaleAccounting(row, customer.name);
      row = await recalcPaid("SALE", sale.id);
    }
    return row;
  });
}

