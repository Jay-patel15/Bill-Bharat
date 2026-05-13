import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest } from "@/lib/db";
import { findWhere } from "@/lib/db";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      const url = new URL(req.url);
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");

      const inRange = (d) => {
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      };

      const sales = await findWhere("sales", (s) => s.companyId === companyId && (!from && !to ? true : inRange(s.invoiceDate)));
      const purchases = await findWhere("purchases", (p) => p.companyId === companyId && (!from && !to ? true : inRange(p.billDate)));

      const out = {
        sales: {
          count: sales.length,
          taxable: sales.reduce((s, x) => s + Number(x.subtotal || 0), 0),
          cgst: sales.reduce((s, x) => s + Number(x.cgst || 0), 0),
          sgst: sales.reduce((s, x) => s + Number(x.sgst || 0), 0),
          igst: sales.reduce((s, x) => s + Number(x.igst || 0), 0),
          total: sales.reduce((s, x) => s + Number(x.total || 0), 0)
        },
        purchases: {
          count: purchases.length,
          taxable: purchases.reduce((s, x) => s + Number(x.subtotal || 0), 0),
          cgst: purchases.reduce((s, x) => s + Number(x.cgst || 0), 0),
          sgst: purchases.reduce((s, x) => s + Number(x.sgst || 0), 0),
          igst: purchases.reduce((s, x) => s + Number(x.igst || 0), 0),
          total: purchases.reduce((s, x) => s + Number(x.total || 0), 0)
        },
        netGstPayable: 0,
        rows: sales.map((s) => ({
          date: s.invoiceDate,
          invoice: s.invoiceNumber,
          taxable: Number(s.subtotal || 0),
          cgst: Number(s.cgst || 0),
          sgst: Number(s.sgst || 0),
          igst: Number(s.igst || 0),
          total: Number(s.total || 0)
        }))
      };
      out.netGstPayable =
        (out.sales.cgst + out.sales.sgst + out.sales.igst) -
        (out.purchases.cgst + out.purchases.sgst + out.purchases.igst);
      return ok(out);
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

