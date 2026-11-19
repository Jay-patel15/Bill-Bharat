import { fail, ok, withUser } from "@/lib/api";
import { assertCompanyAccess, findById, query } from "@/lib/db";

// Money received from one customer, across all of their invoices, newest first.
export async function GET(_req, { params }) {
  return withUser(async (user) => {
    try {
      const customer = await findById("customers", params.id);
      if (!customer) return fail("Customer not found", 404);
      await assertCompanyAccess(user, customer.companyId);
      const rows = await query(
        `SELECT p.*, s."invoiceNumber" AS "invoiceNumber"
           FROM payments p
           JOIN sales s ON s.id = p."refId"
          WHERE s."customerId" = $1 AND p.type = 'SALE'
          ORDER BY p.date DESC, p."createdAt" DESC`,
        [customer.id]
      );
      return ok(rows);
    } catch (e) {
      return fail(e.message, e.status || 500);
    }
  });
}
