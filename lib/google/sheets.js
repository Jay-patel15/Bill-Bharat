import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "https://dummy.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "dummy";
const supabase = createClient(supabaseUrl, supabaseKey);

export const SCHEMAS = {
  users: [
    "id", "email", "passwordHash", "name", "googleId", "role",
    "resetToken", "resetTokenExpiresAt", "createdAt", "updatedAt"
  ],
  companies: [
    "id", "userId", "name", "logoUrl", "address", "city", "state", "stateCode",
    "pincode", "gstNumber", "panNumber", "bankAccountNo", "bankIfsc", "bankName",
    "termsAndConditions", "phone", "email", "createdAt", "updatedAt", "bankBranch"
  ],
  customers: [
    "id", "companyId", "name", "phone", "email", "address", "state", "stateCode",
    "gstNumber", "creditLimit", "outstanding", "createdAt", "updatedAt"
  ],
  inventory: [
    "id", "companyId", "name", "sku", "category", "purchasePrice", "sellingPrice",
    "gstRate", "quantity", "lowStockThreshold", "unit", "hsnCode",
    "createdAt", "updatedAt"
  ],
  sales: [
    "id", "companyId", "customerId", "projectId", "documentType",
    "invoiceNumber", "invoiceDate", "dueDate", "items", "subtotal", "discount",
    "cgst", "sgst", "igst", "total", "amountPaid", "status", "notes", "pdfUrl",
    "createdAt", "updatedAt"
  ],
  projects: [
    "id", "companyId", "customerId", "name", "code", "description",
    "boqItems", "contractValue", "startDate", "endDate", "status", "notes",
    "createdAt", "updatedAt"
  ],
  purchases: [
    "id", "companyId", "supplierName", "supplierGst", "billNumber", "billDate",
    "items", "subtotal", "cgst", "sgst", "igst", "total", "amountPaid",
    "status", "notes", "pdfUrl", "createdAt", "updatedAt", "customerId"
  ],
  product_mappings: [
    "id", "companyId", "realName", "systemName", "createdAt", "updatedAt"
  ],
  payments: [
    "id", "companyId", "type", "refId", "amount", "method", "date", "notes",
    "createdAt"
  ]
};

export async function bootstrap() {
  return true;
}

export async function listAll(table) {
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw new Error(error.message);
  return data || [];
}

export async function findWhere(table, predicate) {
  const all = await listAll(table);
  return all.filter(predicate);
}

export async function findOne(table, predicate) {
  const all = await listAll(table);
  return all.find(predicate) || null;
}

export async function findById(table, id) {
  if (!id) return null;
  const { data, error } = await supabase.from(table).select("*").eq("id", id).single();
  // PGRST116 means no rows returned, which isn't a fatal error, just null result.
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data || null;
}

/**
 * Extracts company ID from request headers or query params.
 */
export function getCompanyIdFromRequest(req) {
  const h = req.headers.get("x-company-id");
  if (h) return h;
  const { searchParams } = new URL(req.url);
  return searchParams.get("companyId");
}

/**
 * Ensures the user has access to the requested company.
 */
export async function assertCompanyAccess(user, companyId) {
  if (!companyId) {
    const err = new Error("Company ID required");
    err.status = 400;
    throw err;
  }
  if (user.role === "admin") return true;
  
  const company = await findById("companies", companyId);
  if (!company || company.userId !== user.id) {
    const err = new Error("FORBIDDEN");
    err.status = 403;
    throw err;
  }
  return true;
}

export async function insert(table, record) {
  const now = new Date().toISOString();
  const id = record.id || randomUUID();
  const enriched = { ...record, id, createdAt: record.createdAt || now, updatedAt: now };
  
  const { data, error } = await supabase.from(table).insert(enriched).select().single();
  if (error) throw new Error(`Supabase insert error on ${table}: ${error.message}`);
  return data;
}

export async function update(table, id, patch) {
  const mergedPatch = { ...patch, updatedAt: new Date().toISOString() };
  const { data, error } = await supabase.from(table).update(mergedPatch).eq("id", id).select().single();
  if (error) throw new Error(`Supabase update error on ${table}: ${error.message}`);
  return data;
}

export async function remove(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw new Error(`Supabase delete error on ${table}: ${error.message}`);
  return true;
}
