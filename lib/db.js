/**
 * lib/db.js — BillBharat Data Access Layer
 *
 * PUBLIC API (unchanged — all existing API routes continue to work):
 *   bootstrap()
 *   listAll(table)
 *   findWhere(table, filters)
 *   findOne(table, filters)
 *   findById(table, id)
 *   insert(table, record)
 *   update(table, id, patch, userId?)
 *   remove(table, id, userId?)
 *   getCompanyIdFromRequest(req)
 *   assertCompanyAccess(user, companyId)
 *   SCHEMAS
 *
 * Implementation: PostgreSQL via node-postgres (pg)
 * Connection:     DATABASE_URL environment variable
 *
 * Migration from Supabase:
 *   - Supabase client replaced with direct pg Pool (lib/db/postgres.js)
 *   - Same quoted camelCase column names ("companyId", "createdAt", etc.)
 *   - JSONB columns (items, boqItems, entries) auto-parsed by pg driver
 *   - NUMERIC columns parsed as float (type parser in lib/db/postgres.js)
 */

import { randomUUID } from "node:crypto";
import { query, queryOne, transaction } from "./db/postgres.js";

// ---------------------------------------------------------------------------
// Schema definitions (preserved exactly — used for column allow-listing)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// JSONB columns — pg returns these already parsed; ensure we handle both raw
// strings (from insert payloads) and already-parsed objects.
// ---------------------------------------------------------------------------
const JSONB_COLUMNS = {
  sales:          ["items"],
  purchases:      ["items"],
  projects:       ["boqItems"],
  journal_entries:["entries"],
  audit_logs:     ["oldData", "newData"]
};

/**
 * Serialize JSONB fields to strings before sending to pg.
 * pg accepts both JS objects and JSON strings for JSONB columns, but we
 * normalise to string to be explicit.
 */
function serializeJsonb(table, record) {
  const cols = JSONB_COLUMNS[table];
  if (!cols) return record;
  const out = { ...record };
  for (const col of cols) {
    if (out[col] !== undefined && typeof out[col] !== "string") {
      out[col] = JSON.stringify(out[col]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Company termsAndConditions packing / unpacking
// (preserves existing behavior: stores template + terms together as JSON)
// ---------------------------------------------------------------------------
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

function packCompanyTerms(record) {
  const out = { ...record };
  const terms = out.termsAndConditions || "";
  let template = {};
  if (out.invoiceTemplate) {
    try {
      template = typeof out.invoiceTemplate === "string"
        ? JSON.parse(out.invoiceTemplate)
        : out.invoiceTemplate;
    } catch {}
  }
  out.termsAndConditions = JSON.stringify({
    termsAndConditions: terms,
    invoiceTemplate: template
  });
  delete out.invoiceTemplate;
  return out;
}

// ---------------------------------------------------------------------------
// Build parameterised WHERE clause from a plain-object filter map
// e.g. { companyId: "abc", status: "unpaid" }
//   → WHERE "companyId" = $1 AND status = $2   params: ["abc", "unpaid"]
// ---------------------------------------------------------------------------
function buildWhere(filters) {
  const keys = Object.keys(filters);
  if (keys.length === 0) return { clause: "", params: [] };
  const parts = keys.map((k, i) => `"${k}" = $${i + 1}`);
  return { clause: "WHERE " + parts.join(" AND "), params: Object.values(filters) };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function bootstrap() {
  // No-op: pool is lazy-initialised on first query.
  return true;
}

export async function listAll(table) {
  const rows = await query(`SELECT * FROM "${table}"`);
  if (table === "companies") return rows.map(formatCompanyRow);
  return rows;
}

export async function findWhere(table, filters) {
  // Object filter → server-side SQL WHERE
  if (typeof filters === "object" && filters !== null) {
    const { clause, params } = buildWhere(filters);
    const rows = await query(`SELECT * FROM "${table}" ${clause}`, params);
    if (table === "companies") return rows.map(formatCompanyRow);
    return rows;
  }

  // Legacy function predicate — full scan fallback (preserves compatibility)
  const rows = await query(`SELECT * FROM "${table}"`);
  const filtered = rows.filter(filters);
  if (table === "companies") return filtered.map(formatCompanyRow);
  return filtered;
}

export async function findOne(table, filters) {
  if (typeof filters === "object" && filters !== null) {
    const { clause, params } = buildWhere(filters);
    const row = await queryOne(
      `SELECT * FROM "${table}" ${clause} LIMIT 1`,
      params
    );
    if (!row) return null;
    return table === "companies" ? formatCompanyRow(row) : row;
  }

  // Legacy function predicate — full scan fallback
  const rows = await query(`SELECT * FROM "${table}"`);
  const row = rows.find(filters) || null;
  return table === "companies" ? formatCompanyRow(row) : row;
}

export async function findById(table, id) {
  if (!id) return null;
  const row = await queryOne(
    `SELECT * FROM "${table}" WHERE id = $1`,
    [id]
  );
  if (!row) return null;
  return table === "companies" ? formatCompanyRow(row) : row;
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

  // Pack company terms/template
  let rec = table === "companies" ? packCompanyTerms(record) : { ...record };

  // Serialize JSONB columns
  rec = serializeJsonb(table, rec);

  const enriched = { ...rec, id, createdAt: rec.createdAt || now };
  if (schema.includes("updatedAt")) {
    enriched.updatedAt = rec.updatedAt || now;
  }

  // Build INSERT ... RETURNING *
  const keys = Object.keys(enriched);
  const cols = keys.map((k) => `"${k}"`).join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const values = Object.values(enriched);

  const row = await queryOne(
    `INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) RETURNING *`,
    values
  );

  if (!row) throw new Error(`Insert into ${table} returned no row`);
  return table === "companies" ? formatCompanyRow(row) : row;
}

export async function update(table, id, patch, userId = null) {
  // Fetch existing row for merge logic (companies need template merge)
  let patchToUpdate = { ...patch };

  if (table === "companies") {
    const existing = await findById("companies", id);
    // Merge existing template if not provided in patch
    if (patchToUpdate.invoiceTemplate === undefined && existing?.invoiceTemplate) {
      patchToUpdate.invoiceTemplate = existing.invoiceTemplate;
    }
    if (patchToUpdate.termsAndConditions === undefined && existing?.termsAndConditions) {
      patchToUpdate.termsAndConditions = existing.termsAndConditions;
    }
    patchToUpdate = packCompanyTerms(patchToUpdate);
  }

  // Serialize JSONB columns
  patchToUpdate = serializeJsonb(table, patchToUpdate);

  const mergedPatch = { ...patchToUpdate, updatedAt: new Date().toISOString() };

  // Build UPDATE ... SET ... WHERE id = $n RETURNING *
  const keys = Object.keys(mergedPatch);
  const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
  const values = [...Object.values(mergedPatch), id];

  const row = await queryOne(
    `UPDATE "${table}" SET ${setClauses} WHERE id = $${keys.length + 1} RETURNING *`,
    values
  );

  if (!row) throw new Error(`Update on ${table}:${id} returned no row`);

  // Fire-and-forget audit log — does not block the response
  if (table !== "audit_logs") {
    insert("audit_logs", {
      companyId: row.companyId,
      userId,
      table,
      recordId: id,
      action: "UPDATE",
      oldData: null,
      newData: JSON.stringify(row)
    }).catch(() => {}); // non-blocking
  }

  return table === "companies" ? formatCompanyRow(row) : row;
}

export async function remove(table, id, userId = null) {
  const oldData = await findById(table, id);

  await query(`DELETE FROM "${table}" WHERE id = $1`, [id]);

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