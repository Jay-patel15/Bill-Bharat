import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatINR, numberToWords } from "./gst";

/**
 * Generate a GST-compliant invoice PDF with proper multi-page handling.
 *
 * @param {Object} args
 * @param {Object} args.company
 * @param {Object} args.customer
 * @param {Object} args.invoice
 * @param {string} [args.title="TAX INVOICE"]
 * @param {boolean} [args.showTax=true]   - hide tax columns/totals (e.g. delivery challan)
 * @param {string} [args.output="buffer"] - "buffer" | "blob" | "datauri"
 */
export function generateInvoicePdf({ company, customer, invoice, title = "TAX INVOICE", showTax = true, output = "buffer" }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;
  const FOOTER_H = 70;

  // ───────────── Page header (drawn on every page) ─────────────
  function drawHeader() {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, W, 70, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(title, M, 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`No: ${invoice.invoiceNumber}`, W - M, 28, { align: "right" });
    doc.text(`Date: ${invoice.invoiceDate}`, W - M, 44, { align: "right" });
    if (invoice.dueDate) doc.text(`Due: ${invoice.dueDate}`, W - M, 60, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }
  drawHeader();
  let y = 90;

  // ───────────── Company / Customer block ─────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(company.name || "", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 14;
  if (company.address) doc.text(company.address, M, y, { maxWidth: 260 }), y += 12;
  const cityLine = [company.city, company.state, company.pincode].filter(Boolean).join(", ");
  if (cityLine) { doc.text(cityLine, M, y); y += 12; }
  if (company.gstNumber) { doc.text(`GSTIN: ${company.gstNumber}`, M, y); y += 12; }
  if (company.panNumber) { doc.text(`PAN: ${company.panNumber}`, M, y); y += 12; }
  if (company.phone || company.email) {
    doc.text([company.phone, company.email].filter(Boolean).join(" | "), M, y); y += 12;
  }

  let cy = 90;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BILL TO", W - M - 220, cy); cy += 14;
  doc.setFontSize(10);
  doc.text(customer.name || "", W - M - 220, cy); cy += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (customer.address) { doc.text(customer.address, W - M - 220, cy, { maxWidth: 220 }); cy += 12; }
  if (customer.state) { doc.text(`${customer.state}${customer.stateCode ? " (" + customer.stateCode + ")" : ""}`, W - M - 220, cy); cy += 12; }
  if (customer.gstNumber) { doc.text(`GSTIN: ${customer.gstNumber}`, W - M - 220, cy); cy += 12; }
  if (customer.phone) { doc.text(`Phone: ${customer.phone}`, W - M - 220, cy); cy += 12; }
  if (customer.email) { doc.text(`Email: ${customer.email}`, W - M - 220, cy); cy += 12; }

  y = Math.max(y, cy) + 12;

  // ───────────── Items table (auto page-break via jspdf-autotable) ─────────────
  const interstate = !!invoice.interstate;
  let head, body;
  if (!showTax) {
    head = [["#", "Item", "HSN", "Qty", "Unit"]];
    body = invoice.items.map((it, i) => [i + 1, it.name || "", it.hsnCode || "-", it.quantity, it.unit || ""]);
  } else if (interstate) {
    head = [["#", "Item", "HSN", "Qty", "Rate", "Disc", "Taxable", "IGST%", "IGST", "Total"]];
    body = invoice.items.map((it, i) => [
      i + 1, it.name || "", it.hsnCode || "-", it.quantity,
      formatINR(it.sellingPrice), formatINR(it.discount || 0),
      formatINR(it.taxable), `${it.gstRate}%`,
      formatINR(it.igst), formatINR(it.total)
    ]);
  } else {
    head = [["#", "Item", "HSN", "Qty", "Rate", "Disc", "Taxable", "GST%", "CGST", "SGST", "Total"]];
    body = invoice.items.map((it, i) => [
      i + 1, it.name || "", it.hsnCode || "-", it.quantity,
      formatINR(it.sellingPrice), formatINR(it.discount || 0),
      formatINR(it.taxable), `${it.gstRate}%`,
      formatINR(it.cgst), formatINR(it.sgst), formatINR(it.total)
    ]);
  }

  autoTable(doc, {
    head,
    body,
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    margin: { left: M, right: M, top: 90, bottom: FOOTER_H },
    didDrawPage: (data) => {
      // jspdf-autotable redraws pages automatically — re-render the brand header
      // on every page after the first.
      if (data.pageNumber > 1) drawHeader();
    }
  });

  let ty = doc.lastAutoTable.finalY + 14;

  // Helper that ensures we have `needed` pts of vertical room before drawing.
  function ensureSpace(needed) {
    if (ty + needed > H - FOOTER_H) {
      doc.addPage();
      drawHeader();
      ty = 90;
    }
  }

  // ───────────── Totals block ─────────────
  if (showTax) {
    const labelsX = W - M - 200;
    const valuesX = W - M;
    const totalsRows = [
      ["Subtotal", formatINR(invoice.subtotal)],
      ...(interstate
        ? [["IGST", formatINR(invoice.igst)]]
        : [["CGST", formatINR(invoice.cgst)], ["SGST", formatINR(invoice.sgst)]]),
      ...(invoice.invoiceDiscount ? [["Discount", "- " + formatINR(invoice.invoiceDiscount)]] : []),
      ...(invoice.roundOff ? [["Round Off", formatINR(invoice.roundOff)]] : [])
    ];
    ensureSpace(totalsRows.length * 14 + 30);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    for (const [label, val] of totalsRows) {
      doc.text(label, labelsX, ty);
      doc.text(val, valuesX, ty, { align: "right" });
      ty += 14;
    }
    doc.setFont("helvetica", "bold");
    doc.text("Grand Total", labelsX, ty);
    doc.text(formatINR(invoice.grandTotal), valuesX, ty, { align: "right" });
    ty += 18;

    ensureSpace(28);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`Amount in words: ${numberToWords(invoice.grandTotal)}`, M, ty, { maxWidth: W - 2 * M });
    ty += 24;
  }

  // ───────────── Bank details ─────────────
  if (showTax && (company.bankName || company.bankAccountNo || company.bankIfsc)) {
    ensureSpace(70);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Bank Details", M, ty); ty += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (company.bankName) { doc.text(`Bank: ${company.bankName}`, M, ty); ty += 11; }
    if (company.bankAccountNo) { doc.text(`A/c No: ${company.bankAccountNo}`, M, ty); ty += 11; }
    if (company.bankIfsc) { doc.text(`IFSC: ${company.bankIfsc}`, M, ty); ty += 11; }
  }

  // ───────────── Terms & Conditions ─────────────
  if (company.termsAndConditions) {
    const tnc = String(company.termsAndConditions);
    const lines = doc.splitTextToSize(tnc, W - 2 * M);
    ensureSpace(20 + lines.length * 10);
    ty += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Terms & Conditions", M, ty); ty += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(lines, M, ty);
    ty += lines.length * 10;
  }

  // ───────────── Notes ─────────────
  if (invoice.notes) {
    const lines = doc.splitTextToSize(String(invoice.notes), W - 2 * M);
    ensureSpace(20 + lines.length * 10);
    ty += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Notes", M, ty); ty += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(lines, M, ty);
    ty += lines.length * 10;
  }

  // ───────────── Signature on the LAST page bottom-right ─────────────
  const totalPages = doc.internal.getNumberOfPages();
  doc.setPage(totalPages);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("For " + (company.name || ""), W - M - 150, H - 70);
  doc.text("Authorised Signatory", W - M - 150, H - 40);

  // ───────────── Page numbers in footer ─────────────
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Page ${p} of ${totalPages}`, M, H - 20);
    doc.setTextColor(0, 0, 0);
  }

  if (output === "blob") return doc.output("blob");
  if (output === "datauri") return doc.output("datauristring");
  return Buffer.from(doc.output("arraybuffer"));
}
