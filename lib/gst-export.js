/**
 * Utility to generate GSTR-1 compatible JSON (Simplified for demonstration)
 * Maps Sales invoices to B2B and B2C sections.
 */
export function generateGSTR1(company, sales) {
  const b2b = [];
  const b2cl = []; // B2C Large
  const b2cs = []; // B2C Small

  for (const s of sales) {
    if (s.documentType !== "Tax Invoice") continue;

    // Simplified B2B/B2C logic based on existence of customer GSTIN
    const it = {
      inum: s.invoiceNumber,
      idt: s.invoiceDate,
      val: s.total,
      pos: s.recipientStateCode || company.stateCode,
      rchrg: "N",
      inv_typ: "R",
      itms: s.items.map((item, idx) => ({
        num: idx + 1,
        itm_det: {
          rt: item.gstRate || 0,
          txval: item.taxable || 0,
          iamt: item.igst || 0,
          camt: item.cgst || 0,
          samt: item.sgst || 0,
          csamt: 0
        }
      }))
    };

    if (s.customerGst) {
      b2b.push({
        ctin: s.customerGst,
        inv: [it]
      });
    } else {
      b2cs.push({
        rt: s.items[0]?.gstRate || 0,
        pos: it.pos,
        typ: "OE",
        txval: s.subtotal,
        iamt: s.igst || 0,
        camt: s.cgst || 0,
        samt: s.sgst || 0,
        csamt: 0
      });
    }
  }

  return {
    gstin: company.gstNumber,
    fp: new Date().toISOString().slice(5, 7) + new Date().toISOString().slice(0, 4), // MMYYYY
    gt: 0,
    cur_gt: 0,
    b2b,
    b2cs
  };
}
