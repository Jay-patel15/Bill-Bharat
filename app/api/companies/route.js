import { fail, ok, readBody, withUser } from "@/lib/api";
import { findWhere, insert } from "@/lib/db";
import { companySchema } from "@/lib/validations";

export async function GET() {
  return withUser(async (user) => {
    const companies = await findWhere("companies", { userId: user.id });
    return ok(companies);
  });
}

export async function POST(req) {
  return withUser(async (user) => {
    const body = await readBody(req);
    const parse = companySchema.safeParse(body);
    if (!parse.success) {
      return fail(parse.error.errors[0]?.message || "Invalid payload", 400);
    }
    const created = await insert("companies", { ...parse.data, userId: user.id });
    return ok(created);
  });
}
