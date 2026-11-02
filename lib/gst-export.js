/**
 * GSTR-1 JSON (B2B invoices + B2CS summary) from Tax Invoices.
 *
 * shortcut: no B2CL (interstate B2C invoices above the GSTN threshold), credit
 * notes or HSN summary; add them before filing directly from this file.
 */
import { gstStateFromGstin } from "./gst.js";

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * @param company   company row
 * @param sales     sales rows for the period
 * @param customers Map customerId -> customer row (for GSTIN and place of supply)
 * @param period    "YYYY-MM" being filed
 */
export function generateGSTR1(company, sales, customers, period) {
  const b2bByCtin = new Map();
  const b2cs = new Map();
  const ownState = company.stateCode || gstStateFromGstin(company.gstNumber);

  for (const s of sales) {
    if ((s.documentType || "Tax Invoice") !== "Tax Invoice") continue;
    const c = customers.get(s.customerId);
    const ctin = (c?.gstNumber || "").trim().toUpperCase();
    const pos = c?.stateCode || gstStateFromGstin(ctin) || ownState;
    const items = s.items || [];

    if (ctin) {
      const inv = {
        inum: s.invoiceNumber,
        idt: s.invoiceDate,
        val: r2(s.total),
        pos,
        rchrg: "N",
        inv_typ: "R",
        itms: items.map((item, idx) => ({
          num: idx + 1,
          itm_det: {
            rt: Number(item.gstRate) || 0,
            txval: r2(item.taxable),
            iamt: r2(item.igst),
            camt: r2(item.cgst),
            samt: r2(item.sgst),
            csamt: 0
          }
        }))
      };
      if (!b2bByCtin.has(ctin)) b2bByCtin.set(ctin, { ctin, inv: [] });
      b2bByCtin.get(ctin).inv.push(inv);
    } else {
      // B2CS is a summary per place of supply and rate, not per invoice.
      for (const item of items) {
        const rt = Number(item.gstRate) || 0;
        const key = `${pos}|${rt}`;
        const row = b2cs.get(key) || { sply_ty: pos === ownState ? "INTRA" : "INTER", rt, pos, typ: "OE", txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        row.txval = r2(row.txval + Number(item.taxable || 0));
        row.iamt = r2(row.iamt + Number(item.igst || 0));
        row.camt = r2(row.camt + Number(item.cgst || 0));
        row.samt = r2(row.samt + Number(item.sgst || 0));
        b2cs.set(key, row);
      }
    }
  }

  const [y, m] = period.split("-");
  return {
    gstin: company.gstNumber,
    fp: `${m}${y}`, // MMYYYY of the period filed, not of today
    gt: 0,
    cur_gt: 0,
    b2b: [...b2bByCtin.values()],
    b2cs: [...b2cs.values()]
  };
}
