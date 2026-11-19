import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { numberToWords, isGstCompany } from "./gst";
import { formatDate, formatINR, STATES } from "./utils";
import { mergeTemplate } from "./invoice-template";

const money = (n) => formatINR(n).replace("₹", "").trim();

/** "27" → "27-Maharashtra" (the form GST invoices print). */
function stateLabel(name, code) {
  const c = code ? String(code).padStart(2, "0") : "";
  const n = name || (c ? STATES.find(([k]) => k === c)?.[1] : "") || "";
  return [c, n].filter(Boolean).join("-") || "—";
}

/** "2025-12-31" → "31/12/2025" (read from the string, so no time-zone shift). */
function dmy(d) {
  const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d ? formatDate(d) : "";
}

/** 80631 → "Rs. EIGHTY THOUSAND SIX HUNDRED THIRTY-ONE ONLY" */
function rupeesInWords(n) {
  return `Rs. ${numberToWords(n).replace(/\s*Rupees Only$/, "").toUpperCase()} ONLY`;
}

/**
 * GST tax invoice, laid out like the standard industrial A4 bill:
 *   header      logo, company name, tagline (Auth. Dist. / Mfgrs. of …), REGD.OFF. address, Tel / E-Mail
 *   ID strip    GSTIN / PAN / STATE | TAX INVOICE, Rule 46 notice, Tax Reverse | Original/Duplicate/Triplicate
 *   dispatch    Invoice, Challan, Order (left) | LR, Transporter, Eway, Payment / Due on (right)
 *   parties     Receiver/Buyer | Consignee/Ship To, with place of supply and GSTIN
 *   items       ruled columns running down the page; sub total, discount, tax by rate and round off inside it
 *   footer      amount in words + grand total | bank + declaration | terms, receiver's sign, For company
 * Long bills flow onto more pages: the item columns continue, "Continued…" marks
 * each page break, and the footer prints once on the last page.
 * What shows and what each part is called comes from the invoice template.
 *
 * Runs in Node (route) and in the browser (template preview, output "blob").
 * `logo` is { dataUrl, format: "PNG" | "JPEG" } or null.
 */
export function generateInvoicePdf({ company, customer, invoice, title = "TAX INVOICE", template, logo = null, output = "buffer" }) {
  const T = mergeTemplate(template);
  // Without a GSTIN the bill is a plain invoice: no GSTIN, HSN, Rule 46 notice or reverse-charge line.
  const gstOn = isGstCompany(company);
  const S = gstOn ? T.show : { ...T.show, gstin: false, hsn: false, reverseCharge: false };
  const L = T.labels;
  const heading = !gstOn && title === "TAX INVOICE" ? "INVOICE" : title;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 30, X1 = W - M, CW = W - 2 * M;
  // Item column widths (description takes the rest). The dispatch/parties divider
  // lines up with the rule before QUANTITY, as on the printed bill.
  const W_ = { sr: 22, hsn: S.hsn ? 52 : 0, qty: 60, rate: 68, unit: S.unit ? 34 : 0, disc: S.disc ? 36 : 0, amount: 68 };
  const descW = CW - Object.values(W_).reduce((a, b) => a + b, 0);
  const SPLIT = M + W_.sr + descW + W_.hsn;
  const meta = invoice.metadata || {};
  const font = (style, size) => { doc.setFont("times", style); doc.setFontSize(size); };
  const hline = (y, x0 = M, x1 = X1) => doc.line(x0, y, x1, y);
  const vline = (x, y0, y1) => doc.line(x, y0, x, y1);
  const wrap = (s, w) => doc.splitTextToSize(String(s || ""), w);
  const dateOf = dmy;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);

  // ── Header ──────────────────────────────────────────────────────────────
  const hasLogo = Boolean(S.logo && logo?.dataUrl);
  if (hasLogo) {
    try {
      const p = doc.getImageProperties(logo.dataUrl);
      const scale = Math.min(70 / p.width, 46 / p.height);
      doc.addImage(logo.dataUrl, logo.format || "PNG", M + 8, M + 6, p.width * scale, p.height * scale);
    } catch { /* unreadable image: print without it */ }
  }
  let y = M + 30;
  font("normal", 24);
  doc.text(company.name || "", W / 2, y, { align: "center", maxWidth: CW - (hasLogo ? 170 : 20) });
  y += 14;
  font("bold", 8.5);
  for (const line of String(T.text.tagline || "").split("\n").filter(Boolean)) {
    for (const l of wrap(line, CW - 40)) { doc.text(l, W / 2, y, { align: "center" }); y += 10; }
  }
  y = Math.max(y, hasLogo ? M + 56 : 0) + 2;
  hline(y);
  y += 12;
  font("normal", 8.8);
  const pin = String(company.pincode || "").replace(/ /g, "\u00a0");
  const cityLine = (company.city || "") + (pin ? `${company.city ? "-" : ""}${pin}` : "");
  const address = [company.address, cityLine].filter(Boolean).join(", ");
  if (address) {
    for (const l of wrap(`${L.regdOff} ${address}.`, CW - 60)) { doc.text(l, W / 2, y, { align: "center" }); y += 10.5; }
  }
  if (S.contacts) {
    const contact = [company.phone && `Tel.: ${company.phone}`, company.email && `E-Mail : ${company.email}`].filter(Boolean).join(" * ");
    if (contact) { font("normal", 8.3); doc.text(contact, W / 2, y, { align: "center" }); y += 10; }
  }
  y -= 4;

  // ── ID strip: GSTIN / PAN / STATE | TAX INVOICE | copies ────────────────
  hline(y);
  const idTop = y, idH = 40, midL = M + CW * 0.46, midR = M + CW * 0.765;
  vline(midL, idTop, idTop + idH);
  vline(midR, idTop, idTop + idH);
  font("bold", 9);
  const ids = [
    S.gstin && `GSTIN: ${company.gstNumber || ""}`,
    S.pan && `PAN NO :  ${company.panNumber || ""}`,
    S.stateCode && `STATE  : ${stateLabel(company.state, company.stateCode || String(company.gstNumber || "").slice(0, 2))}`
  ].filter(Boolean);
  ids.forEach((t, i) => doc.text(t, M + 6, idTop + 12 + i * 11));
  const midX = (midL + midR) / 2;
  font("bold", 11.5);
  doc.text(String(heading).toUpperCase(), midX, idTop + 10, { align: "center" });
  font("normal", 6.6);
  const noticeLines = gstOn ? wrap(L.notice, midR - midL - 10).slice(0, 2) : [];
  noticeLines.forEach((l, i) => doc.text(l, midX, idTop + 18 + i * 7.5, { align: "center" }));
  if (S.reverseCharge) {
    font("italic", 6.8);
    doc.text(`Tax Reverse (N/Y) : ${T.text.reverseCharge}.`, midX, idTop + 20 + noticeLines.length * 7.5, { align: "center" });
  }
  if (S.copies) {
    const tick = X1 - 14, rowH = idH / 3;
    vline(tick, idTop, idTop + idH);
    font("italic", 7.6);
    ["Original For Recipient", "Duplicate for Transporter", "Triplicate for Supplier"].forEach((t, i) => {
      doc.text(t, tick - 5, idTop + rowH * i + 9, { align: "right" });
      if (i) hline(idTop + rowH * i, midR, X1);
    });
  }
  y = idTop + idH;

  // ── Dispatch: two halves of label : value rows ──────────────────────────
  const pair = (a, av, b, bv, bold = false) => ({ a, av, b, bv, bold });
  const leftRows = [
    pair(L.invoiceNo, invoice.invoiceNumber, L.invoiceDate, dateOf(invoice.invoiceDate), true),
    S.challan && pair(L.challan, meta.challanNumber, L.challanDate, dateOf(meta.challanDate)),
    S.order && pair(L.order, meta.orderNumber),
    S.order && pair(L.orderDate, dateOf(meta.orderDate))
  ].filter(Boolean);
  const rightRows = [
    S.lr && pair(L.lr, meta.lrNumber, L.lrDate, dateOf(meta.lrDate)),
    S.transporter && pair(L.transporter, meta.transporter),
    S.eway && pair(L.eway, meta.ewayNumber),
    (S.payment || S.dueDate) && pair(S.payment ? L.payment : L.dueDate, S.payment ? meta.paymentTerms : dateOf(invoice.dueDate),
      S.payment && S.dueDate ? L.dueDate : null, S.payment && S.dueDate ? dateOf(invoice.dueDate) : null, true)
  ].filter(Boolean);
  const rowH = 16;
  const dispatchH = Math.max(leftRows.length, rightRows.length) * rowH + 8;
  hline(y);
  vline(SPLIT, y, y + dispatchH);
  const drawRows = (rows, x0, x1) => rows.forEach((r, i) => {
    const ry = y + 14 + i * rowH;
    font("normal", 8.8);
    doc.text(r.a, x0 + 6, ry);
    const value = `:  ${r.av || ""}`;
    const big = r.bold && i === 0 && x0 === M;
    font(r.bold ? "bold" : "normal", big ? 11 : 8.8);
    if (big && doc.getTextWidth(value) > (x1 - x0) * 0.32) font("bold", 9.5);
    doc.text(value, x0 + 64, ry);
    // Second label starts mid-cell, or after a long first value (e.g. a long invoice number).
    const half = Math.max(x0 + (x1 - x0) * 0.5, x0 + 64 + doc.getTextWidth(value) + 10);
    if (r.b) {
      font("normal", 8.8);
      doc.text(r.b, half, ry);
      font(r.bold ? "bold" : "normal", 8.8);
      doc.text(`:  ${r.bv || ""}`, half + 50, ry);
    }
  });
  drawRows(leftRows, M, SPLIT);
  drawRows(rightRows, SPLIT, X1);
  y += dispatchH;

  // ── Parties ─────────────────────────────────────────────────────────────
  const projectName = invoice.projectName || "";
  const buyer = {
    name: customer.name, address: customer.address, gst: customer.gstNumber, phone: customer.phone,
    pos: stateLabel(customer.state, customer.stateCode || String(customer.gstNumber || "").slice(0, 2))
  };
  const shipTo = meta.consigneeSameAsBuyer === false && meta.consigneeName
    ? { name: meta.consigneeName, address: meta.consigneeAddress, gst: meta.consigneeGst, phone: meta.consigneePhone,
        pos: stateLabel(meta.consigneeState, meta.consigneeStateCode) }
    : { ...buyer, phone: "" };
  const blocks = [[L.buyer, buyer, M, S.consignee ? SPLIT : X1], ...(S.consignee ? [[L.consignee, shipTo, SPLIT, X1]] : [])];
  hline(y);
  let partyEnd = y;
  for (const [heading, p, x0, x1] of blocks) {
    const bx = x0 + 6, bw = x1 - x0 - 12;
    let by = y + 13;
    font("normal", 8.5);
    doc.text(heading, bx, by);
    doc.setLineWidth(0.4); hline(by + 1.5, bx, bx + doc.getTextWidth(heading)); doc.setLineWidth(0.6);
    by += 12;
    font("normal", 8.5); doc.text("M/s.", bx, by);
    font("bold", 9.5); doc.text(wrap(p.name, bw - 22)[0] || "", bx + 20, by);
    by += 14;
    font("normal", 8.5);
    for (const l of String(p.address || "").split("\n").flatMap((a) => wrap(a, bw)).slice(0, 5)) { doc.text(l, bx, by); by += 10.5; }
    if (x0 === M && projectName) { doc.text(`Site: ${projectName}`, bx, by); by += 10.5; }
    if (gstOn) {
      doc.text(`Place Of Supply: ${p.pos}`, bx, by); by += 10.5;
      font("bold", 8.8); doc.text(`GSTIN: ${p.gst || "Unregistered"}`, bx, by); by += 10.5;
    }
    if (p.phone) { font("normal", 8.5); doc.text(`TEL: ${p.phone}`, bx, by); by += 10.5; }
    partyEnd = Math.max(partyEnd, by);
  }
  if (S.consignee) vline(SPLIT, y, partyEnd);
  y = partyEnd;

  // ── Footer geometry (needed now: every page keeps this space free) ──────
  font("normal", 6.9);
  const termsX = M + CW * 0.49, bankSplit = M + CW * 0.66;
  const termText = String(company.termsAndConditions || "").split("\n").map((t) => t.trim()).filter(Boolean)
    .map((t, i) => `${i + 1}.${t.replace(/^\d+[.)]\s*/, "")}`).join(" ");
  const termLines = S.terms ? wrap(termText, termsX - M - 14) : [];
  const wordsH = 24;
  const bankH = S.bank || S.declaration ? 36 : 0;
  const signH = Math.max(54, termLines.length * 8 + 14);
  const footerH = wordsH + bankH + signH;
  const footerTop = H - M - footerH;

  // ── Items ───────────────────────────────────────────────────────────────
  const qtyText = (q) => (Number(q) || 0).toFixed(2);
  const lineAmount = (it) => Number(it.taxable || 0) + Number(it.invoiceDiscountShare || 0);
  const cols = [
    { key: "sr", w: W_.sr, align: "center" },
    { key: "item", w: descW, align: "left" },
    S.hsn && { key: "hsn", w: W_.hsn, align: "center" },
    { key: "qty", w: W_.qty, align: "right" },
    { key: "rate", w: W_.rate, align: "right" },
    S.unit && { key: "unit", w: W_.unit, align: "center" },
    S.disc && { key: "disc", w: W_.disc, align: "right" },
    { key: "amount", w: W_.amount, align: "right" }
  ].filter(Boolean);
  const at = Object.fromEntries(cols.map((c, i) => [c.key, i]));
  const row = (cells) => cols.map((c) => cells[c.key] ?? "");

  const items = invoice.items || [];
  const body = items.map((it, i) => {
    const g = (Number(it.quantity) || 0) * (Number(it.sellingPrice) || 0);
    return row({
      sr: String(i + 1), item: it.name || "", hsn: it.hsnCode || "", qty: qtyText(it.quantity),
      rate: money(it.sellingPrice), unit: it.unit || "",
      disc: Number(it.discount) && g ? `${((Number(it.discount) / g) * 100).toFixed(2)}` : "",
      amount: money(lineAmount(it))
    });
  });

  // Sub total and taxes sit inside the item grid, labels in the RATE column.
  const qtyTotal = items.reduce((t, it) => t + (Number(it.quantity) || 0), 0);
  const gross = Math.round(items.reduce((t, it) => t + lineAmount(it), 0) * 100) / 100;
  const byRate = new Map();
  for (const it of items) {
    const r = Number(it.gstRate) || 0;
    const t = byRate.get(r) || { cgst: 0, sgst: 0, igst: 0 };
    t.cgst += Number(it.cgst || 0); t.sgst += Number(it.sgst || 0); t.igst += Number(it.igst || 0);
    byRate.set(r, t);
  }
  const roundOff = Math.round((Number(invoice.grandTotal) - Number(invoice.subtotal)
    - Number(invoice.cgst || 0) - Number(invoice.sgst || 0) - Number(invoice.igst || 0)) * 100) / 100;
  const summary = [["", gross]];
  if (invoice.invoiceDiscount) summary.push(["Less: Discount", -invoice.invoiceDiscount], ["Taxable Value", invoice.subtotal]);
  for (const [r, t] of [...byRate.entries()].sort((a, b) => a[0] - b[0])) {
    if (t.sgst > 0) summary.push([`SGST @ ${r / 2}%`, t.sgst]);
    if (t.cgst > 0) summary.push([`CGST @ ${r / 2}%`, t.cgst]);
    if (t.igst > 0) summary.push([`IGST @ ${r}%`, t.igst]);
  }
  if (roundOff) summary.push(["Round Off", roundOff]);
  body.push(row({}));
  const subtotalRow = body.length;
  summary.forEach(([label, value], i) => body.push(row(i === 0 ? { qty: qtyText(qtyTotal), amount: money(value) } : { rate: label, amount: money(value) })));

  const ruled = { top: 0, bottom: 0, left: 0.6, right: 0.6 };
  autoTable(doc, {
    head: [cols.map((c) => L[c.key])],
    body,
    startY: y,
    theme: "plain",
    styles: { font: "times", fontSize: 8.8, cellPadding: { top: 2.2, bottom: 2.2, left: 4, right: 4 }, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: ruled, valign: "top" },
    headStyles: { fontStyle: "normal", halign: "center", valign: "middle", lineWidth: 0.6, minCellHeight: 20 },
    columnStyles: Object.fromEntries(cols.map((c, i) => [i, { halign: c.align, ...(c.w ? { cellWidth: c.w } : {}) }])),
    margin: { left: M, right: M, top: M + 22, bottom: M + footerH },
    didParseCell: (d) => {
      if (d.section !== "body") return;
      if (d.row.index === subtotalRow) { d.cell.styles.fontStyle = "bold"; d.cell.styles.minCellHeight = 18; d.cell.styles.valign = "bottom"; }
      if (d.row.index > subtotalRow && d.column.index === at.rate) d.cell.styles.halign = "center";
    },
    didDrawCell: (d) => {
      // Rule above the quantity and amount totals.
      if (d.section === "body" && d.row.index === subtotalRow && (d.column.index === at.qty || d.column.index === at.amount)) {
        hline(d.cell.y + 3, d.cell.x + 4, d.cell.x + d.cell.width - 4);
      }
    },
    didDrawPage: (d) => {
      // Keep the column rules running down to the footer, on every page.
      let x = M;
      const top = d.cursor?.y ?? y;
      for (const c of d.table.columns) {
        x += c.width;
        if (x < X1 - 1) vline(x, top, footerTop);
      }
      if (d.pageNumber > 1) {
        font("italic", 8);
        doc.text(`${title} ${invoice.invoiceNumber || ""} (continued)`, M + 6, M + 14);
        hline(M + 22);
      }
    }
  });

  // ── Footer: on the last page; earlier pages say "continued" ─────────────
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p < pages; p++) {
    doc.setPage(p);
    hline(footerTop);
    font("italic", 9);
    doc.text("Continued on next page…", W / 2, footerTop + 16, { align: "center" });
  }
  doc.setPage(pages);
  let fy = footerTop;
  const amountX = X1 - cols.at(-1).w;
  hline(fy);
  vline(amountX, fy, fy + wordsH);
  font("bold", 8.6);
  doc.text(wrap(rupeesInWords(invoice.grandTotal), amountX - M - 12)[0], M + 8, fy + 15);
  font("bold", 10.5);
  doc.text(money(invoice.grandTotal), X1 - 5, fy + 15, { align: "right" });
  fy += wordsH;

  if (bankH) {
    hline(fy);
    vline(bankSplit, fy, fy + bankH);
    if (S.bank) {
      const cx = (M + bankSplit) / 2;
      font("bold", 9);
      const line1 = `${L.bank} : ${[company.bankName, company.bankBranch && `Br.${company.bankBranch}`].filter(Boolean).join(", ") || "—"}.`;
      const line2 = [company.bankAccountNo && `C.A.No.${company.bankAccountNo}`, company.bankIfsc && `IFSC CODE : ${company.bankIfsc}`].filter(Boolean).join(" * ");
      doc.text(wrap(line1, bankSplit - M - 12)[0], cx, fy + 14, { align: "center" });
      if (line2) doc.text(line2, cx, fy + 26, { align: "center" });
    }
    if (S.declaration) {
      font("normal", 7.2);
      wrap(T.text.declaration, X1 - bankSplit - 14).slice(0, 3)
        .forEach((l, i) => doc.text(l, (bankSplit + X1) / 2, fy + 13 + i * 8.5, { align: "center" }));
    }
    fy += bankH;
  }

  hline(fy);
  vline(termsX, fy, fy + signH);
  vline(bankSplit, fy, fy + signH);
  font("normal", 6.9);
  termLines.forEach((l, i) => doc.text(l, (M + termsX) / 2, fy + 11 + i * 8, { align: "center" }));
  if (S.receiverSign) {
    font("normal", 8.5);
    doc.rect(termsX + 4, fy + signH - 18, bankSplit - termsX - 8, 14);
    doc.text(L.receiverSign, (termsX + bankSplit) / 2, fy + signH - 8, { align: "center" });
  }
  font("bold", 9);
  doc.text(`For ${(company.name || "").toUpperCase()}`, X1 - 8, fy + 14, { align: "right" });
  font("normal", 8.5);
  doc.text("E. & .O.E", bankSplit + 30, fy + signH - 8);
  doc.text(L.authSign, X1 - 8, fy + signH - 8, { align: "right" });

  // ── Frame and page numbers ──────────────────────────────────────────────
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setLineWidth(1);
    doc.rect(M, M, CW, H - 2 * M);
    if (pages > 1) {
      font("normal", 7.5);
      doc.text(`Page ${p} of ${pages}`, X1, H - M + 11, { align: "right" });
    }
  }

  if (output === "blob") return doc.output("blob");
  if (output === "datauri") return doc.output("datauristring");
  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Generate outstanding dues PDF matching Biz Analyst / Tally formatting.
 */
export function generateOutstandingPdf({ company, parties, totalAmount, totalParties, label, title }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const borderMargin = 40;
  const contentWidth = W - 2 * borderMargin;

  let y = 50;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`${company.name || ""}: ${title}`, borderMargin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y += 16;
  doc.text(`As on ${formatDate(new Date())}`, borderMargin, y);
  y += 14;
  doc.text(`Total ${label}: ${totalParties}`, borderMargin, y);
  y += 14;
  doc.text(`Total Amount: ${formatINR(totalAmount).replace("₹", "").trim()}`, borderMargin, y);
  y += 25;

  for (const cust of parties) {
    if (y + 120 > H - 100) {
      doc.addPage();
      y = 50;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(cust.name.toUpperCase(), W / 2, y, { align: "center" });
    y += 10;

    const head = [["Date", "Ref. No.", "Bill Amount", "Paid", "Pending", label === "Suppliers" ? "Bill date" : "Due on", "Days"]];
    const body = cust.rows.map((r) => [
      r.date ? formatDate(r.date) : "",
      r.refNo || "",
      money(r.billAmount),
      money(r.paid),
      money(r.pendingAmount),
      r.dueOn ? formatDate(r.dueOn) : "",
      r.overdueDays > 0 ? String(r.overdueDays) : ""
    ]);
    body.push(["", "Total", money(cust.rows.reduce((t, r) => t + r.billAmount, 0)),
      money(cust.rows.reduce((t, r) => t + r.paid, 0)), money(cust.totalPending), "", ""]);

    autoTable(doc, {
      head,
      body,
      startY: y,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.5 },
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
      columnStyles: {
        0: { halign: "center", cellWidth: 62 },
        1: { halign: "center" },
        2: { halign: "right", cellWidth: 78 },
        3: { halign: "right", cellWidth: 70 },
        4: { halign: "right", fontStyle: "bold", cellWidth: 78 },
        5: { halign: "center", cellWidth: 62 },
        6: { halign: "center", cellWidth: 40 }
      },
      margin: { left: borderMargin, right: borderMargin },
      didParseCell: (data) => {
        if (data.section === "body" && data.row.index === body.length - 1) data.cell.styles.fontStyle = "bold";
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

/**
 * Party statement PDF.
 *   layout "combined" — one table: every bill's lines in date order (the default).
 *   layout "bills"    — one heading and its own table for each bill, in the same PDF.
 */
export function generateStatementPdf({ company, statement: st, layout = "combined" }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const m = 40;
  const pageH = doc.internal.pageSize.getHeight();
  const supplier = st.party === "suppliers";
  const period = st.from || st.to ? `${st.from ? formatDate(st.from) : "Start"} to ${st.to ? formatDate(st.to) : formatDate(new Date())}` : `All dates, as on ${formatDate(new Date())}`;
  const grid = (startY, head, body, right) => autoTable(doc, {
    head: [head], body, startY, theme: "grid",
    styles: { fontSize: 8, cellPadding: 4, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.5 },
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: Object.fromEntries(right.map((i) => [i, { halign: "right" }])),
    margin: { left: m, right: m },
    didParseCell: (d) => { if (d.section === "body" && d.row.index === body.length - 1) d.cell.styles.fontStyle = "bold"; }
  });
  const head = ["Date", "Particulars", "Ref. No.", supplier ? "Bill" : "Debit", supplier ? "Paid" : "Credit", "Balance"];
  const lineRow = (e) => [formatDate(e.date), e.particulars, e.refNo || "", e.debit ? money(e.debit) : "", e.credit ? money(e.credit) : "", money(e.balance)];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(company.name || "", m, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text([company.address, [company.city, company.state, company.pincode].filter(Boolean).join(", "),
    company.gstNumber ? `GSTIN: ${company.gstNumber}` : ""].filter(Boolean), m, 63);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${supplier ? "Supplier" : "Customer"} statement: ${st.name}`, m, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(period, m, 119);

  let y = 128;
  if (st.ids?.length) {
    const refs = st.invoices.filter((b) => st.ids.includes(b.id)).map((b) => b.refNo).join(", ");
    const lines = doc.splitTextToSize(`${supplier ? "Bills" : "Invoices"}: ${refs}`, doc.internal.pageSize.getWidth() - 2 * m);
    doc.text(lines, m, 131);
    y += lines.length * 11;
  }

  if (layout === "bills" && st.sections?.length) {
    for (const sec of st.sections) {
      // Keep a bill's heading with its table: start a new page if there is no room for both.
      if (y > pageH - 150) { doc.addPage(); y = 50; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`${supplier ? "Bill" : "Invoice"} ${sec.bill.refNo}   ·   Date ${formatDate(sec.bill.date)}   ·   Amount Rs. ${money(sec.bill.amount)}`, m, y + 10);
      grid(y + 16, head,
        [["", "Opening balance", "", "", "", money(sec.opening)],
         ...sec.ledger.map(lineRow),
         ["", `Closing balance, ${sec.bill.refNo}`, "", money(sec.debitTotal), money(sec.creditTotal), money(sec.closing)]],
        [3, 4, 5]);
      y = doc.lastAutoTable.finalY + 22;
    }
    if (y > pageH - 110) { doc.addPage(); y = 50; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`All bills: ${supplier ? "billed" : "invoiced"} Rs. ${money(st.debitTotal)}, ${supplier ? "paid" : "received"} Rs. ${money(st.creditTotal)}`, m, y);
    y += 14;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Ledger", m, y + 4);
    grid(y + 12, head,
      [["", "Opening balance", "", "", "", money(st.opening)],
       ...st.ledger.map(lineRow),
       ["", "Closing balance", "", money(st.debitTotal), money(st.creditTotal), money(st.closing)]],
      [3, 4, 5]);
    y = doc.lastAutoTable.finalY + 18;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`${supplier ? "Amount payable" : "Amount receivable"}: Rs. ${money(st.closing)}`, m, y);
  return Buffer.from(doc.output("arraybuffer"));
}

