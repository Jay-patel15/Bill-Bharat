import { randomUUID } from "node:crypto";
import { getSheetsClient } from "./auth";
import * as jsonStore from "../local/json-store.js";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

/**
 * Schema definition for every "table" we keep in the spreadsheet.
 * Order is significant — it defines the column order in the sheet.
 */
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
    "status", "notes", "pdfUrl", "createdAt", "updatedAt"
  ],
  payments: [
    "id", "companyId", "type", "refId", "amount", "method", "date", "notes",
    "createdAt"
  ]
};

/** Decide which adapter to use. Auto-detects when Google creds are missing. */
function shouldUseJson() {
  if (process.env.DATA_BACKEND === "json") return true;
  if (process.env.DATA_BACKEND === "google") return false;
  return !process.env.GOOGLE_CREDENTIALS_JSON && !process.env.GOOGLE_CREDENTIALS_BASE64;
}
const useJson = shouldUseJson();

// --- Google Sheets implementation (private) ---
const TAB_TITLE = (name) => name.charAt(0).toUpperCase() + name.slice(1);
let _bootstrapped = false;

// ── In-memory read cache ──────────────────────────────────────────────────────
// Each entry: { data: [...], fetchedAt: Date.now() }
// TTL: 30 seconds. Writes always invalidate the relevant table's cache.
const CACHE_TTL_MS = 30_000;
const _cache = new Map();

function cacheGet(table) {
  const entry = _cache.get(table);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    _cache.delete(table);
    return null;
  }
  return entry.data;
}

function cacheSet(table, data) {
  _cache.set(table, { data, fetchedAt: Date.now() });
}

function cacheBust(table) {
  _cache.delete(table);
}
// ─────────────────────────────────────────────────────────────────────────────

async function ensureSheetExists(sheets, table) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const titles = meta.data.sheets.map((s) => s.properties.title);
  const tab = TAB_TITLE(table);
  if (!titles.includes(tab)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] }
    });
  }
  const header = SCHEMAS[table];
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: `${tab}!1:1`
  });
  const existing = (res.data.values && res.data.values[0]) || [];
  const same = existing.length === header.length && header.every((h, i) => existing[i] === h);
  if (!same) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [header] }
    });
  }
}

async function googleBootstrap() {
  if (_bootstrapped) return;
  if (!SPREADSHEET_ID) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID not set");
  const sheets = getSheetsClient();
  for (const table of Object.keys(SCHEMAS)) {
    await ensureSheetExists(sheets, table);
  }
  _bootstrapped = true;
}

function rowToObject(table, row) {
  const schema = SCHEMAS[table];
  const obj = {};
  schema.forEach((col, i) => {
    let v = row[i];
    if (v === undefined) v = "";
    if ((col === "items" || col === "boqItems") && typeof v === "string" && v) {
      try { v = JSON.parse(v); } catch {}
    }
    obj[col] = v;
  });
  obj.__row = row;
  return obj;
}

function objectToRow(table, obj) {
  const schema = SCHEMAS[table];
  return schema.map((col) => {
    const v = obj[col];
    if (v === undefined || v === null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  });
}

async function googleListAll(table) {
  await googleBootstrap();

  // Return cached data if still fresh
  const cached = cacheGet(table);
  if (cached) return cached;

  const sheets = getSheetsClient();
  const tab = TAB_TITLE(table);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!A2:ZZ`
  });
  const rows = res.data.values || [];
  const result = rows.filter((r) => r.length > 0 && r[0]).map((r) => rowToObject(table, r));

  cacheSet(table, result);
  return result;
}

async function googleFindWhere(table, predicate) {
  return (await googleListAll(table)).filter(predicate);
}
async function googleFindOne(table, predicate) {
  return (await googleListAll(table)).find(predicate) || null;
}
async function googleFindById(table, id) {
  if (!id) return null;
  return googleFindOne(table, (r) => r.id === id);
}

async function googleInsert(table, record) {
  await googleBootstrap();
  const sheets = getSheetsClient();
  const tab = TAB_TITLE(table);
  const now = new Date().toISOString();
  const id = record.id || randomUUID();
  const enriched = { ...record, id, createdAt: record.createdAt || now, updatedAt: now };
  const row = objectToRow(table, enriched);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] }
  });
  cacheBust(table);  // invalidate cache after write
  return enriched;
}

async function getRowIndexById(table, id) {
  await googleBootstrap();
  const sheets = getSheetsClient();
  const tab = TAB_TITLE(table);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: `${tab}!A:A`
  });
  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) return i + 1;
  }
  return -1;
}

async function googleUpdate(table, id, patch) {
  const existing = await googleFindById(table, id);
  if (!existing) throw new Error(`${table}:${id} not found`);
  const merged = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
  delete merged.__row;
  const idx = await getRowIndexById(table, id);
  if (idx < 0) throw new Error(`${table}:${id} row missing`);
  const sheets = getSheetsClient();
  const tab = TAB_TITLE(table);
  const row = objectToRow(table, merged);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!A${idx}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] }
  });
  cacheBust(table);  // invalidate cache after write
  return merged;
}

async function googleRemove(table, id) {
  const idx = await getRowIndexById(table, id);
  if (idx < 0) return false;
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const tab = TAB_TITLE(table);
  const sheetMeta = meta.data.sheets.find((s) => s.properties.title === tab);
  const sheetId = sheetMeta.properties.sheetId;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: idx - 1, endIndex: idx }
        }
      }]
    }
  });
  cacheBust(table);  // invalidate cache after write
  return true;
}

// --- Public API: dispatch to JSON or Google adapter based on env ---
export const bootstrap = useJson ? jsonStore.bootstrap : googleBootstrap;
export const listAll   = useJson ? jsonStore.listAll   : googleListAll;
export const findWhere = useJson ? jsonStore.findWhere : googleFindWhere;
export const findOne   = useJson ? jsonStore.findOne   : googleFindOne;
export const findById  = useJson ? jsonStore.findById  : googleFindById;
export const insert    = useJson ? jsonStore.insert    : googleInsert;
export const update    = useJson ? jsonStore.update    : googleUpdate;
export const remove    = useJson ? jsonStore.remove    : googleRemove;
