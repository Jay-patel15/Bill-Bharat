// Self-check for the product CSV import. Uses a throwaway database in the OS temp folder.
// Run: node scripts/test-inventory-import.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-inv-import-"));
process.env.BILLBHARAT_DATA_DIR = dir;

const { insert, findWhere } = await import("../lib/db.js");
const { importInventory } = await import("../lib/inventory-import.js");

const user = await insert("users", { id: "u-imp", email: "imp@test.local", role: "user" });
const company = await insert("companies", { userId: user.id, name: "Import Co" });
await insert("inventory", { companyId: company.id, name: "Copper Wire", sku: "W1", unit: "MTR" });

const rows = [
  { name: "Switch" },                                                        // line 2: added with defaults
  { Name: " Fan ", sku: "F1", "HSN Code": "8414", "Selling Price": "1200", gst_rate: "18" }, // line 3: added
  { name: "copper wire" },                                                  // line 4: name exists (case-insensitive)
  { name: "Plug", sku: "w1" },                                              // line 5: SKU exists
  { name: "Bulb", "selling price": "abc" },                                 // line 6: bad number
  { name: "   " },                                                          // line 7: no name
  { name: "Fan" },                                                          // line 8: repeats line 3
  { name: "Tube", quantity: "-3" }                                          // line 9: added
];

const result = await importInventory(company.id, rows);
assert.equal(result.added, 3);
assert.deepEqual(result.skipped.map((s) => s.line), [4, 5, 6, 7, 8]);
assert.match(result.skipped.find((s) => s.line === 6).reason, /not a number/);
assert.match(result.skipped.find((s) => s.line === 5).reason, /SKU w1 already exists/i);

const stored = await findWhere("inventory", { companyId: company.id });
const byName = (n) => stored.find((i) => i.name === n);
assert.equal(stored.length, 4); // the existing wire plus three added
assert.equal(byName("Switch").unit, "PCS");
assert.equal(byName("Switch").sellingPrice, 0);
assert.equal(byName("Fan").sku, "F1");
assert.equal(byName("Fan").hsnCode, "8414");
assert.equal(byName("Fan").sellingPrice, 1200);
assert.equal(byName("Fan").gstRate, 18);
assert.equal(byName("Tube").quantity, -3);
assert.equal(byName("Plug"), undefined);

// A header with the byte-order mark Excel adds to CSV files still matches "name".
assert.deepEqual((await importInventory(company.id, [{ "﻿name": "Bom Item" }])).skipped, []);
assert.ok(await findWhere("inventory", { companyId: company.id, name: "Bom Item" }).then((r) => r.length === 1));

// Nothing to import, or too many rows, is refused outright.
await assert.rejects(importInventory(company.id, []), { status: 400 });
await assert.rejects(importInventory(company.id, Array.from({ length: 5001 }, (_, i) => ({ name: `P${i}` }))), { status: 400 });

fs.rmSync(dir, { recursive: true, force: true });
console.log("inventory import: all checks passed");
