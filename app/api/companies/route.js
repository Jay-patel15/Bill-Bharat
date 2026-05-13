import { fail, ok, readBody, withUser } from "@/lib/api";
import { findWhere, insert } from "@/lib/db";

export async function GET() {
  return withUser(async (user) => {
    const companies = await findWhere("companies", (c) => c.userId === user.id);
    return ok(companies);
  });
}

export async function POST(req) {
  return withUser(async (user) => {
    const body = await readBody(req);
    if (!body.name) return fail("name required", 400);
    const created = await insert("companies", { ...body, userId: user.id });
    return ok(created);
  });
}

