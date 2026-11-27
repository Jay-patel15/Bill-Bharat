import { findWhere, insert, transaction } from "./db.js";
import { inventorySchema } from "./validations.js";

const MAX_ROWS = 5000;
const NUMBER_FIELDS = ["purchaseprice", "sellingprice", "gstrate", "quantity", "lowstockthreshold"];

/** Header names are matched loosely: "HSN Code", "hsn_code" and "hsncode" are the same column. */
const normKey = (k) => String(k).replace(/^﻿/, "").toLowerCase().replace(/[\s_-]/g, ""); // BOM: Excel saves CSVs with one

/**
 * Adds products from parsed CSV rows (one object per line, keys = header names).
 * Only the name is required. A row is skipped, never guessed at, when its name or SKU already
 * exists, repeats an earlier row, or has a bad number. Returns the count added and each skipped line.
 */
export async function importInventory(companyId, rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw httpError("The file has no rows", 400);
  if (rows.length > MAX_ROWS) throw httpError(`Import at most ${MAX_ROWS} rows at a time`, 400);

  const existing = await findWhere("inventory", { companyId });
  const names = new Set(existing.map((i) => String(i.name).trim().toLowerCase()));
  const skus = new Set(existing.filter((i) => i.sku).map((i) => String(i.sku).trim().toLowerCase()));

  const skipped = [];
  const toAdd = [];
  rows.forEach((raw, idx) => {
    const row = Object.fromEntries(Object.entries(raw || {}).map(([k, v]) => [normKey(k), v]));
    const line = idx + 2; // line 1 is the header
    const name = String(row.name ?? "").trim();
    const skip = (reason) => skipped.push({ line, name, reason });
    if (!name) return skip("no name");

    const sku = String(row.sku ?? "").trim();
    if (names.has(name.toLowerCase())) return skip("an item with this name already exists");
    if (sku && skus.has(sku.toLowerCase())) return skip(`SKU ${sku} already exists`);

    const record = {
      companyId,
      name,
      sku: sku || null,
      barcode: String(row.barcode ?? "").trim() || null,
      category: String(row.category ?? "").trim() || null,
      hsnCode: String(row.hsncode ?? "").trim() || null,
      unit: String(row.unit ?? "").trim() || "PCS"
    };
    const numbers = { purchaseprice: "purchasePrice", sellingprice: "sellingPrice", gstrate: "gstRate", quantity: "quantity", lowstockthreshold: "lowStockThreshold" };
    for (const f of NUMBER_FIELDS) {
      const text = String(row[f] ?? "").trim();
      if (text === "") continue; // blank: the schema default (0) applies
      const n = Number(text);
      if (!Number.isFinite(n)) return skip(`${numbers[f]} "${text}" is not a number`);
      record[numbers[f]] = n;
    }

    const parse = inventorySchema.safeParse(record);
    if (!parse.success) return skip(parse.error.errors[0]?.message || "invalid row");

    names.add(name.toLowerCase());
    if (sku) skus.add(sku.toLowerCase());
    toAdd.push(parse.data);
  });

  await transaction(async () => {
    for (const rec of toAdd) await insert("inventory", rec);
  });
  return { added: toAdd.length, skipped };
}

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}
