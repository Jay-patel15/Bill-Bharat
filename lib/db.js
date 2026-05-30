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
  ],
  audit_logs: [
    "id", "companyId", "userId", "table", "recordId", "action", "oldData", "newData", "createdAt"
  ],
  ledger_entries: [
    "id", "companyId", "date", "type", "refId", "ledgerName", "debit", "credit", "description", "createdAt"
  ],
  journal_entries: [
    "id", "companyId", "date", "description", "entries", "createdAt", "updatedAt"
  ]
};

function formatCompanyRow(row) {
  if (!row) return row;
  let template = {};
  let terms = row.termsAndConditions || "";
  try {
    const parsed = JSON.parse(row.termsAndConditions);
    if (parsed && typeof parsed === "object" && "invoiceTemplate" in parsed) {
      template = parsed.invoiceTemplate || {};
      terms = parsed.termsAndConditions || "";
    }
  } catch {}
  return {
    ...row,
    invoiceTemplate: JSON.stringify(template),
    termsAndConditions: terms
  };
}

export async function bootstrap() {
  return true;
}

export async function listAll(table) {
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw new Error(error.message);
  const rows = data || [];
  if (table === "companies") return rows.map(formatCompanyRow);
  return rows;
}

export async function findWhere(table, filters) {
  // filters can be an object { key: value } for server-side filtering
  // or a function (legacy) — falls back to full scan only if needed
  if (typeof filters === "object" && filters !== null) {
    let query = supabase.from(table).select("*");
    for (const [key, val] of Object.entries(filters)) {
      query = query.eq(key, val);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = data || [];
    if (table === "companies") return rows.map(formatCompanyRow);
    return rows;
  }
  // Legacy function predicate — full scan fallback
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw new Error(error.message);
  const rows = (data || []).filter(filters);
  if (table === "companies") return rows.map(formatCompanyRow);
  return rows;
}

export async function findOne(table, filters) {
  if (typeof filters === "object" && filters !== null) {
    let query = supabase.from(table).select("*");
    for (const [key, val] of Object.entries(filters)) {
      query = query.eq(key, val);
    }
    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return table === "companies" ? formatCompanyRow(data) : data;
  }
  // Legacy function predicate — full scan fallback
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw new Error(error.message);
  const row = (data || []).find(filters) || null;
  return table === "companies" ? formatCompanyRow(row) : row;
}

export async function findById(table, id) {
  if (!id) return null;
  const { data, error } = await supabase.from(table).select("*").eq("id", id).single();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  if (!data) return null;
  return table === "companies" ? formatCompanyRow(data) : data;
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
  const schema = SCHEMAS[table] || [];
  
  let recordToInsert = { ...record };
  if (table === "companies") {
    const terms = recordToInsert.termsAndConditions || "";
    let template = {};
    if (recordToInsert.invoiceTemplate) {
      try {
        template = typeof recordToInsert.invoiceTemplate === "string"
          ? JSON.parse(recordToInsert.invoiceTemplate)
          : recordToInsert.invoiceTemplate;
      } catch {}
    }
    recordToInsert.termsAndConditions = JSON.stringify({
      termsAndConditions: terms,
      invoiceTemplate: template
    });
    delete recordToInsert.invoiceTemplate;
  }

  const enriched = { ...recordToInsert, id, createdAt: recordToInsert.createdAt || now };
  if (schema.includes("updatedAt")) {
    enriched.updatedAt = recordToInsert.updatedAt || now;
  }
  
  const { data, error } = await supabase.from(table).insert(enriched).select().single();
  if (error) throw new Error(`Supabase insert error on ${table}: ${error.message}`);
  return table === "companies" ? formatCompanyRow(data) : data;
}

export async function update(table, id, patch, userId = null) {
  let patchToUpdate = { ...patch };
  if (table === "companies") {
    const existing = await findById("companies", id);
    let terms = patchToUpdate.termsAndConditions !== undefined
      ? patchToUpdate.termsAndConditions
      : (existing?.termsAndConditions || "");
    
    let template = {};
    if (patchToUpdate.invoiceTemplate !== undefined) {
      try {
        template = typeof patchToUpdate.invoiceTemplate === "string"
          ? JSON.parse(patchToUpdate.invoiceTemplate)
          : patchToUpdate.invoiceTemplate;
      } catch {}
    } else if (existing?.invoiceTemplate) {
      try {
        template = typeof existing.invoiceTemplate === "string"
          ? JSON.parse(existing.invoiceTemplate)
          : existing.invoiceTemplate;
      } catch {}
    }

    patchToUpdate.termsAndConditions = JSON.stringify({
      termsAndConditions: terms,
      invoiceTemplate: template
    });
    delete patchToUpdate.invoiceTemplate;
  }

  const mergedPatch = { ...patchToUpdate, updatedAt: new Date().toISOString() };
  const { data, error } = await supabase.from(table).update(mergedPatch).eq("id", id).select().single();
  if (error) throw new Error(`Supabase update error on ${table}: ${error.message}`);

  // Fire-and-forget audit log — does not block the response
  if (table !== "audit_logs") {
    insert("audit_logs", {
      companyId: data.companyId,
      userId,
      table,
      recordId: id,
      action: "UPDATE",
      oldData: null,
      newData: JSON.stringify(data)
    }).catch(() => {}); // non-blocking
  }

  return table === "companies" ? formatCompanyRow(data) : data;
}

export async function remove(table, id, userId = null) {
  const oldData = await findById(table, id);
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw new Error(`Supabase delete error on ${table}: ${error.message}`);

  if (table !== "audit_logs") {
    await insert("audit_logs", {
      companyId: oldData?.companyId,
      userId,
      table,
      recordId: id,
      action: "DELETE",
      oldData: JSON.stringify(oldData),
      newData: null
    });
  }
  
  return true;
}