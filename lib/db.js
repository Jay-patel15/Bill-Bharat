import { findById } from "./google/sheets";

/**
 * Assert that the given companyId belongs to the user. Returns the company
 * record on success, throws (status 403) otherwise.
 */
export async function assertCompanyAccess(user, companyId) {
  if (!companyId) {
    const e = new Error("companyId required"); e.status = 400; throw e;
  }
  const company = await findById("companies", companyId);
  if (!company || company.userId !== user.id) {
    const e = new Error("Forbidden"); e.status = 403; throw e;
  }
  return company;
}

export function getCompanyIdFromRequest(req) {
  const url = new URL(req.url);
  return req.headers.get("x-company-id") || url.searchParams.get("companyId");
}
