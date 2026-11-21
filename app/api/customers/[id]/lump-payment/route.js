import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, findWhere } from "@/lib/db";
import { payLumpSum } from "@/lib/lump";

/** POST /api/customers/:id/lump-payment  { amount, method } — settles their Tax Invoices oldest first. */
export async function POST(req, { params }) {
  return withUser(async (user) => {
    try {
      const customer = await findById("customers", params.id);
      if (!customer) return fail("Customer not found", 404);
      await assertCompanyAccess(user, customer.companyId);

      const body = await readBody(req);
      const sales = (await findWhere("sales", { companyId: customer.companyId, customerId: customer.id }))
        .filter((s) => (s.documentType || "Tax Invoice") === "Tax Invoice");
      return ok(await payLumpSum("SALE", sales, { amount: body.amount, method: body.method || body.paymentMethod }));
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
