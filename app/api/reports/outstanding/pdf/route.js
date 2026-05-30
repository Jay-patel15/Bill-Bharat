import { fail, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findById, findWhere } from "@/lib/db";
import { generateOutstandingPdf } from "@/lib/pdf";
import { diffDays } from "@/lib/utils";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);
      
      const company = await findById("companies", companyId);
      if (!company) return fail("Company not found", 404);

      const [sales, customers] = await Promise.all([
        findWhere("sales", { companyId }),
        findWhere("customers", { companyId })
      ]);

      // Filter to only Tax Invoices with a pending balance
      const outstandingSales = sales.filter(
        (s) => (s.documentType || "Tax Invoice") === "Tax Invoice" && Number(s.total) - Number(s.amountPaid) > 0
      );

      const grouped = {};
      let grandTotal = 0;

      outstandingSales.forEach((s) => {
        const custId = s.customerId;
        if (!custId) return;

        if (!grouped[custId]) {
          const c = customers.find((cust) => cust.id === custId);
          grouped[custId] = {
            id: custId,
            name: c ? c.name : "Unknown Customer",
            rows: [],
            totalPending: 0
          };
        }

        const pendingAmount = Number(s.total) - Number(s.amountPaid);
        const dueOn = s.dueDate || s.invoiceDate;
        const overdueDays = diffDays(dueOn);

        grouped[custId].rows.push({
          date: s.invoiceDate,
          refNo: s.invoiceNumber,
          pendingAmount,
          dueOn,
          overdueDays: overdueDays > 0 && new Date() > new Date(dueOn) ? overdueDays : 0
        });

        grouped[custId].totalPending += pendingAmount;
        grandTotal += pendingAmount;
      });

      const list = Object.values(grouped)
        .filter((c) => c.totalPending > 0)
        .sort((a, b) => a.name.localeCompare(b.name));

      const pdfBuffer = generateOutstandingPdf({
        company,
        customersOutstanding: list,
        totalAmount: grandTotal,
        totalCustomers: list.length
      });

      return new Response(pdfBuffer, {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `inline; filename="outstanding-dues.pdf"`
        }
      });
    } catch (e) {
      return fail(e.message, e.status || 500);
    }
  });
}
