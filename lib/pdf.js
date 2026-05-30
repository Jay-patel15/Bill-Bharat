import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatINR, numberToWords } from "./gst";
import { formatDate } from "./utils";

/**
 * Generate a GST-compliant boxed invoice PDF matching traditional layouts.
 *
 * @param {Object} args
 * @param {Object} args.company
 * @param {Object} args.customer
 * @param {Object} args.invoice
 * @param {string} [args.title="TAX INVOICE"]
 * @param {boolean} [args.showTax=true]
 * @param {string} [args.output="buffer"]
 */
export function generateInvoicePdf({ company, customer, invoice, title = "TAX INVOICE", showTax = true, output = "buffer" }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  
  const borderMargin = 30;
  const contentWidth = W - 2 * borderMargin; // 535.28 pt
  const contentHeight = H - 2 * borderMargin; // 781.89 pt

  // ───────────── Company Header (Page 1 Only) ─────────────
  let y = 45;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(company.name || "", W / 2, y, { align: "center" });
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const companyLines = [];
  if (company.address) companyLines.push(company.address);
  const cityLine = [company.city, company.state, company.pincode].filter(Boolean).join(", ");
  if (cityLine) companyLines.push(cityLine);
  const contactLine = [company.phone ? `Tel: ${company.phone}` : "", company.email ? `Email: ${company.email}` : ""].filter(Boolean).join(" | ");
  if (contactLine) companyLines.push(contactLine);
  
  for (const line of companyLines) {
    doc.text(line, W / 2, y, { align: "center" });
    y += 10;
  }

  // Draw division line under company logo/details
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(borderMargin, 85, borderMargin + contentWidth, 85);

  // ───────────── Tax Invoice Header Bar ─────────────
  // Vertical lines
  doc.line(160, 85, 160, 115);
  doc.line(W - 150, 85, W - 150, 115);

  // Left Section: GSTIN & PAN
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("GSTIN: " + (company.gstNumber || ""), borderMargin + 5, 97);
  doc.text("PAN NO: " + (company.panNumber || ""), borderMargin + 5, 107);

  // Middle Section: TAX INVOICE
  doc.setFontSize(11);
  doc.text(title.toUpperCase(), 160 + (W - 150 - 160) / 2, 99, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text("(Supply of goods under rule 46 of CGST rules, 2017)", 160 + (W - 150 - 160) / 2, 107, { align: "center" });

  // Right Section: Checkboxes
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("[ ] Original For Recipient", W - 145, 94);
  doc.text("[ ] Duplicate For Transporter", W - 145, 102);
  doc.text("[ ] Triplicate For Supplier", W - 145, 110);

  // Line separating Header Bar from Metadata Grid
  doc.line(borderMargin, 115, borderMargin + contentWidth, 115);

  // ───────────── Metadata Grid ─────────────
  const meta = invoice.metadata || {};
  
  // Draw vertical dividers for metadata grid
  doc.line(160, 115, 160, 175);
  doc.line(297, 115, 297, 175);
  doc.line(425, 115, 425, 175);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  
  // Row Y-positions: 127, 139, 151, 163
  // Column 1
  doc.text(`Invoice No: ${invoice.invoiceNumber || ""}`, borderMargin + 5, 127);
  doc.text(`Challan No: ${meta.challanNumber || "—"}`, borderMargin + 5, 139);
  doc.text(`Order No: ${meta.orderNumber || "—"}`, borderMargin + 5, 151);
  doc.text(`Order Dt: ${formatDate(meta.orderDate) || "—"}`, borderMargin + 5, 163);

  // Column 2
  doc.text(`Invoice Dt: ${formatDate(invoice.invoiceDate) || ""}`, 165, 127);
  doc.text(`Challan Dt: ${formatDate(meta.challanDate) || "—"}`, 165, 139);

  // Column 3
  doc.text(`L.R. No: ${meta.lrNumber || "—"}`, 302, 127);
  doc.text(`Transporter: ${meta.transporter || "—"}`, 302, 139);
  doc.text(`E-way No: ${meta.ewayNumber || "—"}`, 302, 151);

  // Column 4
  doc.text(`L.R. Dt: ${formatDate(meta.lrDate) || "—"}`, 430, 127);
  doc.text(`Payment: ${meta.paymentTerms || "—"}`, 430, 139);
  doc.text(`Due On: ${formatDate(invoice.dueDate) || "—"}`, 430, 151);

  // Line separating Metadata Grid from Buyer/Consignee Info
  doc.line(borderMargin, 175, borderMargin + contentWidth, 175);

  // ───────────── Buyer vs Consignee Info ─────────────
  // Vertical divider between Buyer & Consignee
  doc.line(297, 175, 297, 260);

  // Buyer Info (Bill To)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Name of Receiver/Buyer (Bill To)", borderMargin + 5, 187);
  doc.setFontSize(8.5);
  doc.text(customer.name || "", borderMargin + 5, 198);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  let by = 208;
  if (customer.address) {
    const lines = doc.splitTextToSize(customer.address, 250);
    doc.text(lines, borderMargin + 5, by);
    by += lines.length * 8.5;
  }
  doc.text(`GSTIN: ${customer.gstNumber || "—"}`, borderMargin + 5, by);
  by += 9;
  if (customer.phone) {
    doc.text(`Tel: ${customer.phone}`, borderMargin + 5, by);
  }

  // Consignee Info (Ship To)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Name of Consignee (Ship To)", 302, 187);
  doc.setFontSize(8.5);
  
  if (meta.consigneeSameAsBuyer || !meta.consigneeName) {
    doc.text(customer.name || "", 302, 198);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    let cy = 208;
    if (customer.address) {
      const lines = doc.splitTextToSize(customer.address, 250);
      doc.text(lines, 302, cy);
      cy += lines.length * 8.5;
    }
    doc.text(`GSTIN: ${customer.gstNumber || "—"}`, 302, cy);
    cy += 9;
    if (customer.phone) {
      doc.text(`Tel: ${customer.phone}`, 302, cy);
    }
  } else {
    doc.text(meta.consigneeName, 302, 198);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    let cy = 208;
    if (meta.consigneeAddress) {
      const lines = doc.splitTextToSize(meta.consigneeAddress, 250);
      doc.text(lines, 302, cy);
      cy += lines.length * 8.5;
    }
    doc.text(`GSTIN: ${meta.consigneeGst || "—"}`, 302, cy);
    cy += 9;
    if (meta.consigneePhone) {
      doc.text(`Tel: ${meta.consigneePhone}`, 302, cy);
    }
  }

  // Line separating Buyer/Consignee Info from Items Table
  doc.line(borderMargin, 260, borderMargin + contentWidth, 260);

  // ───────────── Items Table ─────────────
  const head = [["Sr", "Item Description", "HSN", "Quantity", "Rate", "Unit", "Disc%", "Amount"]];
  const body = invoice.items.map((it, i) => [
    i + 1,
    it.name || "",
    it.hsnCode || "—",
    it.quantity,
    formatINR(it.sellingPrice).replace("₹", "").trim(),
    it.unit || "PCS",
    it.discount ? `${it.discount}%` : "—",
    formatINR(it.taxable || it.total).replace("₹", "").trim()
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 260,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 4, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", lineWidth: 0.5, lineColor: [0, 0, 0] },
    columnStyles: {
      0: { width: 25, halign: "center" },
      1: { halign: "left" },
      2: { width: 55, halign: "center" },
      3: { width: 50, halign: "right" },
      4: { width: 55, halign: "right" },
      5: { width: 40, halign: "center" },
      6: { width: 40, halign: "right" },
      7: { width: 65, halign: "right" }
    },
    margin: { left: borderMargin, right: borderMargin, top: 40, bottom: 200 }
  });

  // ───────────── Footer Box (On Last Page) ─────────────
  let ty = doc.lastAutoTable.finalY + 10;
  const neededSpace = 175;
  if (ty + neededSpace > H - borderMargin) {
    doc.addPage();
    ty = borderMargin + 10;
  }

  const footerBoxY = ty;
  const footerBoxH = H - borderMargin - footerBoxY;
  
  // Draw outer borders of the footer box
  doc.rect(borderMargin, footerBoxY, contentWidth, footerBoxH);
  
  // Vertical divider line in footer
  doc.line(305, footerBoxY, 305, H - borderMargin);

  // Left Side: Words, Bank Details, Terms
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Amount Chargeable (in words):", borderMargin + 5, footerBoxY + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`INR ${numberToWords(invoice.grandTotal)}`, borderMargin + 5, footerBoxY + 20, { maxWidth: 265 });

  let bankY = footerBoxY + 38;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Company's Bank Details:", borderMargin + 5, bankY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Bank Name  : ${company.bankName || "—"}`, borderMargin + 5, bankY + 10);
  doc.text(`A/c No.    : ${company.bankAccountNo || "—"}`, borderMargin + 5, bankY + 19);
  doc.text(`IFSC Code  : ${company.bankIfsc || "—"}`, borderMargin + 5, bankY + 28);
  doc.text(`Branch     : ${company.bankBranch || "—"}`, borderMargin + 5, bankY + 37);

  let termsY = bankY + 49;
  doc.line(borderMargin, termsY, 305, termsY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Terms & Conditions:", borderMargin + 5, termsY + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  if (company.termsAndConditions) {
    const lines = doc.splitTextToSize(String(company.termsAndConditions), 265);
    doc.text(lines, borderMargin + 5, termsY + 16);
  }

  // Right Side: Totals & Signatures
  let ry = footerBoxY;
  const rowH = 13;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const totals = [
    ["Subtotal (Taxable Value)", invoice.subtotal],
    ...(invoice.igst > 0
      ? [["IGST Output", invoice.igst]]
      : [["CGST Output", invoice.cgst], ["SGST Output", invoice.sgst]]),
    ...(invoice.invoiceDiscount ? [["Discount", -invoice.invoiceDiscount]] : []),
    ...(invoice.roundOff ? [["Round Off", invoice.roundOff]] : [])
  ];

  for (const [label, val] of totals) {
    doc.text(label, 310, ry + 9);
    doc.text(formatINR(val).replace("₹", "").trim(), borderMargin + contentWidth - 5, ry + 9, { align: "right" });
    ry += rowH;
    doc.line(305, ry, borderMargin + contentWidth, ry);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Grand Total", 310, ry + 11);
  doc.text(formatINR(invoice.grandTotal), borderMargin + contentWidth - 5, ry + 11, { align: "right" });
  ry += 16;
  doc.line(305, ry, borderMargin + contentWidth, ry);

  // Signatures
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("For " + (company.name || "").toUpperCase(), 310, ry + 10);
  doc.text("Authorised Signatory", borderMargin + contentWidth - 10, H - borderMargin - 12, { align: "right" });

  // ───────────── Outer Border Frame and Page Numbers on All Pages ─────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    
    // Draw page border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.rect(borderMargin, borderMargin, contentWidth, contentHeight);
    
    // Draw footer page number
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${p} of ${totalPages}`, borderMargin + 10, H - borderMargin - 12);
  }

  if (output === "blob") return doc.output("blob");
  if (output === "datauri") return doc.output("datauristring");
  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Generate outstanding dues PDF matching Biz Analyst / Tally formatting.
 */
export function generateOutstandingPdf({ company, customersOutstanding, totalAmount, totalCustomers }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const borderMargin = 40;
  const contentWidth = W - 2 * borderMargin;

  let y = 50;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("List of outstanding due.", borderMargin, y);
  y += 14;
  doc.text(`Total Customers: ${totalCustomers}`, borderMargin, y);
  y += 14;
  doc.text(`Total Amount: ${formatINR(totalAmount).replace("₹", "").trim()}`, borderMargin, y);
  y += 25;

  for (const cust of customersOutstanding) {
    if (y + 120 > H - 100) {
      doc.addPage();
      y = 50;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(cust.name.toUpperCase(), W / 2, y, { align: "center" });
    y += 10;

    const head = [["Date", "Ref. No.", "Pending Amount", "Due on", "Overdue by days"]];
    const body = cust.rows.map((r) => [
      r.date ? formatDate(r.date) : "",
      r.refNo || "",
      formatINR(r.pendingAmount).replace("₹", "").trim(),
      r.dueOn ? formatDate(r.dueOn) : "",
      r.overdueDays !== undefined && r.overdueDays > 0 ? String(r.overdueDays) : ""
    ]);

    // Total row
    body.push([
      "",
      "Total",
      formatINR(cust.totalPending).replace("₹", "").trim(),
      "",
      ""
    ]);

    autoTable(doc, {
      head,
      body,
      startY: y,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 5, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.5 },
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
      columnStyles: {
        0: { halign: "center", width: 90 },
        1: { halign: "center", width: 100 },
        2: { halign: "right", fontStyle: "bold", width: 120 },
        3: { halign: "center", width: 90 },
        4: { halign: "center", width: 100 }
      },
      margin: { left: borderMargin, right: borderMargin },
      didParseCell: (data) => {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = "bold";
        }
      }
    });

    y = doc.lastAutoTable.finalY + 25;
  }

  if (y + 160 > H) {
    doc.addPage();
    y = 50;
  }

  // Grand Total box
  doc.rect(borderMargin + 100, y, contentWidth - 200, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("Total", borderMargin + 130, y + 16);
  doc.text(formatINR(totalAmount).replace("₹", "").trim(), borderMargin + contentWidth - 130, y + 16, { align: "right" });

  y += 50;

  // Regards footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Regards,", borderMargin, y);
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.text((company.name || "").toUpperCase(), borderMargin, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const footerLines = [];
  if (company.address) footerLines.push(company.address);
  const cityLine = [company.city, company.state, company.pincode].filter(Boolean).join(", ");
  if (cityLine) footerLines.push(cityLine);
  if (company.phone) footerLines.push(`Phone no. : ${company.phone}`);
  if (company.gstNumber) footerLines.push(`GSTIN : ${company.gstNumber}`);
  if (company.email) footerLines.push(`E-Mail : ${company.email}`);

  for (const line of footerLines) {
    doc.text(line, borderMargin, y);
    y += 10;
  }

  return Buffer.from(doc.output("arraybuffer"));
}
