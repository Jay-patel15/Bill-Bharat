// Self-check for consumables stock moves. Uses a throwaway database in the OS temp folder.
// Run: node scripts/test-consumables.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-consumables-"));
process.env.BILLBHARAT_DATA_DIR = dir;

const { insert, findById } = await import("../lib/db.js");
const { checkConsumables, moveStock } = await import("../lib/consumables.js");

const user = await insert("users", { id: "u-test", email: "consumables@test.local", role: "user" });
const company = await insert("companies", { userId: user.id, name: "Test Co" });
const cable = await insert("inventory", { companyId: company.id, name: "6 sq mm wire", unit: "MTR", quantity: 60 });
const pipe = await insert("inventory", { companyId: company.id, name: "20mm pipe", unit: "MTR", quantity: 10 });
const line = await insert("inventory", { companyId: company.id, name: "Electrical Works", unit: "JOB", quantity: 0, consumables: 1 });
const other = await insert("companies", { userId: user.id, name: "Other Co" });
const foreign = await insert("inventory", { companyId: other.id, name: "Foreign wire", unit: "MTR", quantity: 5 });

const qty = async (id) => Number((await findById("inventory", id)).quantity);

// Parts are checked and stored with the stock item's real name and unit.
const parts = await checkConsumables(company.id, line.id, [{ inventoryId: cable.id, quantity: 20 }]);
assert.deepEqual(parts, [{ inventoryId: cable.id, name: "6 sq mm wire", unit: "MTR", quantity: 20 }]);

// Consumables only on the Electrical Works line.
await assert.rejects(checkConsumables(company.id, cable.id, [{ inventoryId: pipe.id, quantity: 1 }]), { status: 400 });
// Parts must be stock of the same company, not the Electrical Works line itself.
await assert.rejects(checkConsumables(company.id, line.id, [{ inventoryId: foreign.id, quantity: 1 }]), { status: 400 });
await assert.rejects(checkConsumables(company.id, line.id, [{ inventoryId: line.id, quantity: 1 }]), { status: 400 });
assert.deepEqual(await checkConsumables(company.id, cable.id, []), []);

// A switched-off Electrical Works item (consumables = 2) still accepts parts, so old invoices stay editable.
const off = await insert("inventory", { companyId: company.id, name: "Electrical Works", unit: "JOB", consumables: 2 });
await checkConsumables(company.id, off.id, [{ inventoryId: cable.id, quantity: 2 }]);
// An Electrical Works item that was deleted by an older version: its invoices still take parts.
await checkConsumables(company.id, "deleted-item-id", [{ inventoryId: cable.id, quantity: 2 }]);
// A plain free-text line cannot take parts.
await assert.rejects(checkConsumables(company.id, null, [{ inventoryId: cable.id, quantity: 1 }]), { status: 400 });

// Issue on sale: 20 m of wire out, the lump-sum line itself moves nothing.
const items = [{ inventoryId: line.id, quantity: 1, consumablesUsed: parts }];
await moveStock(company.id, items, -1, user.id);
assert.equal(await qty(cable.id), 40);
assert.equal(await qty(line.id), 0);

// Two parts, same item listed twice: both come out.
await moveStock(company.id, [{ inventoryId: line.id, quantity: 1, consumablesUsed: [
  { inventoryId: cable.id, quantity: 5 }, { inventoryId: cable.id, quantity: 5 }
] }], -1, user.id);
assert.equal(await qty(cable.id), 30);

// Negative stock is allowed (as elsewhere in the app).
await moveStock(company.id, [{ inventoryId: pipe.id, quantity: 15 }], -1, user.id);
assert.equal(await qty(pipe.id), -5);

// Deleting the sale puts everything back, and the Electrical Works line still moves nothing.
await moveStock(company.id, items, 1, user.id);
await moveStock(company.id, [{ inventoryId: line.id, quantity: 1, consumablesUsed: [
  { inventoryId: cable.id, quantity: 10 }
] }], 1, user.id);
assert.equal(await qty(cable.id), 60);
assert.equal(await qty(line.id), 0);

fs.rmSync(dir, { recursive: true, force: true });
console.log("consumables: all checks passed");
