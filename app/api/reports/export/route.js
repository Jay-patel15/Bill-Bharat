import * as XLSX from "xlsx";
import { fail, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findWhere, withDues } from "@/lib/db";

const TYPES = {
  sales: { table: "sales", filename: "sales-report.xlsx" },
  purchases: { table: "purchases", filename: "purchases-report.xlsx" },
  customers: { table: "customers", filename: "customer-outstanding.xlsx" },
  inventory: { table: "inventory", filename: "inventory.xlsx" }
};

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const url = new URL(req.url);
      const type = url.searchParams.get("type") || "sales";
      const cfg = TYPES[type];
      if (!cfg) return fail("invalid type", 400);

      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      let rows = await findWhere(cfg.table, { companyId });
      if (type === "customers") rows = await withDues(companyId, rows);
      // Quotations carry no money owed or earned: keep their amounts out of the sales export.
      if (type === "sales") rows = rows.filter((r) => r.documentType !== "Quotation");

      const flatRows = rows.map((r) => {
        const o = { ...r };
        if (typeof o.items === "object") o.items = JSON.stringify(o.items);
        return o;
      });

      const ws = XLSX.utils.json_to_sheet(flatRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, type);
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return new Response(buf, {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="${cfg.filename}"`
        }
      });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

