/**
 * lib/db.js — BillBharat Data Access Layer
 *
 * PUBLIC API (unchanged — all existing API routes continue to work):
 *   listAll(table)
 *   findWhere(table, filters)
 *   findOne(table, filters)
 *   findById(table, id)
 *   insert(table, record)
 *   update(table, id, patch, userId?)
 *   remove(table, id, userId?)
 *   getCompanyIdFromRequest(req)
 *   assertCompanyAccess(user, companyId)
 *   getSetting(key)
 *   setSetting(key, value)
 *   deleteSetting(key)
 *   SCHEMAS
 *
 * Implementation: local SQLite file via lib/db/sqlite.js. No server, no
 *                 network, no configuration — the database is a single file
 *                 under the app data directory (see lib/paths.js).
 *
 * Notes:
 *   - Same quoted camelCase column names ("companyId", "createdAt", etc.)
 *   - JSON columns (items, boqItems, entries) are stored as TEXT and parsed
 *     back to objects in formatRow(), matching what the pg driver used to do
 *     automatically for JSONB.
 *   - NUMERIC columns are REAL, so they arrive as JS numbers as before.
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { filesDir } from "./paths.js";
import { query, queryOne, transaction } from "./db/sqlite.js";

export { query, transaction };

// ---------------------------------------------------------------------------
// Schema definitions (preserved exactly — used for column allow-listing)
// ---------------------------------------------------------------------------
export const SCHEMAS = {
  users: [
    "id", "email", "passwordHash", "name", "role",
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
    "gstRate", "quantity", "lowStockThreshold", "unit", "hsnCode", "barcode",
    "consumables", "createdAt", "updatedAt"
  ],
  sales: [
    "id", "companyId", "customerId", "projectId", "documentType",
    "invoiceNumber", "invoiceDate", "dueDate", "items", "subtotal", "discount",
    "cgst", "sgst", "igst", "total", "amountPaid", "status", "notes", "pdfUrl",
    "convertedToId", "createdAt", "updatedAt"
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
  ],
  app_settings: [
    "id", "key", "value", "createdAt", "updatedAt"
  ]
};

// ---------------------------------------------------------------------------
// JSON columns — stored as TEXT in SQLite, exposed to callers as objects.
// ---------------------------------------------------------------------------
const JSONB_COLUMNS = {
  sales:          ["items"],
  purchases:      ["items"],
  projects:       ["boqItems"],
  journal_entries:["entries"],
  audit_logs:     ["oldData", "newData"]
};

/**
 * Serialize JSON fields to strings on the way in. Callers pass either an
 * object or an already-stringified payload; both are accepted.
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

/**
 * Parse JSON fields on the way out, so callers keep receiving objects exactly
 * as they did from the pg driver's JSONB handling. A column holding invalid
 * JSON falls back to null rather than throwing — a corrupt notes blob should
 * not take down a whole invoice list.
 */
function parseJsonb(table, row) {
  const cols = JSONB_COLUMNS[table];
  if (!cols) return row;
  const out = { ...row };
  for (const col of cols) {
    if (typeof out[col] !== "string") continue;
    try {
      out[col] = JSON.parse(out[col]);
    } catch {
      out[col] = null;
    }
  }
  return out;
}

/**
 * Older builds stored company terms as JSON {termsAndConditions, invoiceTemplate}
 * (the removed template designer). Unwrap those; new writes store plain text.
 */
function formatCompanyRow(row) {
  if (!row?.termsAndConditions?.startsWith("{")) return row;
  try {
    const parsed = JSON.parse(row.termsAndConditions);
    if (parsed && "invoiceTemplate" in parsed) return { ...row, termsAndConditions: parsed.termsAndConditions || "" };
  } catch {}
  return row;
}

/**
 * Single formatting funnel for every row leaving this module: JSON columns
 * parsed, legacy company terms unwrapped. Every read and every RETURNING
 * row goes through here so the shape is identical on all paths.
 */
function formatRow(table, row) {
  if (!row) return row;
  const parsed = parseJsonb(table, row);
  return table === "companies" ? formatCompanyRow(parsed) : parsed;
}

function formatRows(table, rows) {
  return rows.map((row) => formatRow(table, row));
}

// ---------------------------------------------------------------------------
// Build parameterised WHERE clause from a plain-object filter map
// e.g. { companyId: "abc", status: "unpaid" }
//   → WHERE "companyId" = $1 AND status = $2   params: ["abc", "unpaid"]
// ---------------------------------------------------------------------------
/** Column names are interpolated into SQL, so only known columns get through. */
function assertColumns(table, keys) {
  const allowed = SCHEMAS[table];
  const bad = keys.find((k) => !allowed?.includes(k));
  if (bad !== undefined) throw new Error(`Unknown column "${bad}" for ${table}`);
}

function buildWhere(table, filters) {
  if (!filters || typeof filters !== "object") throw new Error("findWhere/findOne need an object filter");
  const keys = Object.keys(filters);
  assertColumns(table, keys);
  if (keys.length === 0) return { clause: "", params: [] };
  const parts = keys.map((k, i) => `"${k}" = $${i + 1}`);
  return { clause: "WHERE " + parts.join(" AND "), params: Object.values(filters) };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listAll(table) {
  return formatRows(table, await query(`SELECT * FROM "${table}"`));
}

export async function findWhere(table, filters) {
  const { clause, params } = buildWhere(table, filters);
  return formatRows(table, await query(`SELECT * FROM "${table}" ${clause}`, params));
}

export async function findOne(table, filters) {
  const { clause, params } = buildWhere(table, filters);
  const row = await queryOne(`SELECT * FROM "${table}" ${clause} LIMIT 1`, params);
  return row ? formatRow(table, row) : null;
}

/**
 * Amount each customer still owes, from Tax Invoices. Computed, never stored:
 * a stored running balance drifts with every edit path that forgets it.
 */
export async function customerDues(companyId) {
  const rows = await query(
    `SELECT "customerId", SUM(total - "amountPaid") AS due FROM sales
     WHERE "companyId" = $1 AND COALESCE("documentType", 'Tax Invoice') = 'Tax Invoice'
     GROUP BY "customerId"`,
    [companyId]
  );
  return new Map(rows.map((r) => [r.customerId, Math.max(0, Math.round(r.due * 100) / 100)]));
}

export async function withDues(companyId, customers) {
  const dues = await customerDues(companyId);
  return customers.map((c) => ({ ...c, outstanding: dues.get(c.id) || 0 }));
}

export async function findById(table, id) {
  if (!id) return null;
  const row = await queryOne(`SELECT * FROM "${table}" WHERE id = $1`, [id]);
  return row ? formatRow(table, row) : null;
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
  if (process.env.DEV_BYPASS_AUTH === "1") return true;

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

  const rec = serializeJsonb(table, record);

  const enriched = { ...rec, id, createdAt: rec.createdAt || now };
  if (schema.includes("updatedAt")) {
    enriched.updatedAt = rec.updatedAt || now;
  }

  // Build INSERT ... RETURNING *
  const keys = Object.keys(enriched);
  assertColumns(table, keys);
  const cols = keys.map((k) => `"${k}"`).join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const values = Object.values(enriched);

  const row = await queryOne(
    `INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) RETURNING *`,
    values
  );

  if (!row) throw new Error(`Insert into ${table} returned no row`);
  return formatRow(table, row);
}

export async function update(table, id, patch, userId = null) {
  // Only tables that have an updatedAt column get one (payments does not).
  const hasUpdatedAt = (SCHEMAS[table] || []).includes("updatedAt");
  const mergedPatch = { ...serializeJsonb(table, patch), ...(hasUpdatedAt ? { updatedAt: new Date().toISOString() } : {}) };

  // Build UPDATE ... SET ... WHERE id = $n RETURNING *
  const keys = Object.keys(mergedPatch);
  assertColumns(table, keys);
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

  return formatRow(table, row);
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

// ---------------------------------------------------------------------------
// App Settings Key-Value Store (Offline / Local Configuration)
// ---------------------------------------------------------------------------

export async function getSetting(key) {
  if (!key) return null;
  const row = await queryOne(`SELECT value FROM app_settings WHERE key = $1`, [key]);
  return row?.value ?? null;
}

export async function setSetting(key, value) {
  if (!key) throw new Error("Setting key required");
  const now = new Date().toISOString();
  const id = randomUUID();
  await query(
    `INSERT INTO app_settings (id, key, value, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, "updatedAt" = excluded."updatedAt"`,
    [id, key, String(value ?? ""), now, now]
  );
  return value;
}

export async function deleteSetting(key) {
  if (!key) return false;
  await query(`DELETE FROM app_settings WHERE key = $1`, [key]);
  return true;
}

// Kept by eraseAllBooks: the login, app-wide settings (AI key) and the database's own bookkeeping.
const KEEP_ON_ERASE = new Set(["users", "app_settings", "_schema_migrations", "_app_meta"]);

/**
 * Factory reset of the books: every company and everything in them (customers,
 * items, sales, purchases, payments, ledger, audit log), per-company settings
 * and uploaded files. The caller checks the password and takes a backup first.
 */
export async function eraseAllBooks() {
  const tables = (await query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`))
    .map((t) => t.name).filter((n) => !KEEP_ON_ERASE.has(n));
  await transaction(async () => {
    await query("PRAGMA defer_foreign_keys = ON"); // order-free deletes; checked once at commit
    for (const t of tables) await query(`DELETE FROM "${t}"`);
    await query(`DELETE FROM app_settings WHERE key LIKE 'invoice_template:%'`);
  });
  fs.rmSync(filesDir(), { recursive: true, force: true });
  filesDir(); // recreate empty
  return tables;
}
