/**
 * scripts/check-db.mjs — self-check for the local SQLite data layer.
 *
 *   npm run check
 *
 * Runs against a throwaway database in the OS temp dir, so it never touches
 * real books. Covers the behaviour that changed when Postgres was swapped for
 * SQLite: $n placeholder rewriting, JSON columns arriving as objects rather
 * than strings, numeric columns arriving as numbers, the company
 * terms/template packing, and foreign-key enforcement.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bb-check-"));
process.env.BILLBHARAT_DATA_DIR = tmp;

/**
 * The data layer is ESM, but the project's package.json has no
 * "type": "module" — Next.js transpiles these files, plain `node` does not,
 * so it would load them as CommonJS and fail on the first `import`.
 *
 * Marking lib/ as an ESM scope would fix that and break the app: several
 * modules in there default-import CommonJS packages (jspdf-autotable, jose,
 * zod), whose interop changes under strict ESM. So instead copy the data
 * layer into a scratch directory that carries its own module marker. It
 * stays inside the project so `node-sqlite3-wasm` still resolves by walking
 * up to the real node_modules, and the app's own files are left untouched.
 */
const scratch = path.join(root, ".check-tmp");
const LAYER = ["paths.js", "db.js", "db/schema.js", "db/sqlite.js"];

function stageDataLayer() {
  fs.rmSync(scratch, { recursive: true, force: true });
  fs.mkdirSync(path.join(scratch, "lib", "db"), { recursive: true });
  fs.writeFileSync(path.join(scratch, "package.json"), '{ "type": "module" }');
  for (const rel of LAYER) {
    fs.copyFileSync(path.join(root, "lib", rel), path.join(scratch, "lib", rel));
  }
  return path.join(scratch, "lib");
}

const stagedLib = stageDataLayer();

function cleanup() {
  fs.rmSync(scratch, { recursive: true, force: true });
  fs.rmSync(tmp, { recursive: true, force: true });
}

process.on("exit", cleanup);

const {
  bootstrap, insert, update, remove,
  findById, findOne, findWhere, listAll
} = await import(pathToFileURL(path.join(stagedLib, "db.js")).href);

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ok    ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
}

console.log(`\nlocal database self-check  (${tmp})\n`);

await bootstrap();

// --- fixtures, in FK order ------------------------------------------------
const user = await insert("users", {
  email: "check@local", passwordHash: "x", name: "Checker", role: "admin"
});
const company = await insert("companies", {
  userId: user.id, name: "Acme Traders", gstNumber: "24AAAAA0000A1Z5",
  termsAndConditions: "Payment within 30 days",
  invoiceTemplate: JSON.stringify({ accent: "#0f172a", showBank: true })
});
const customer = await insert("customers", {
  companyId: company.id, name: "Bharat Steel", creditLimit: 50000, outstanding: 1234.56
});

await check("schema applied and tables are queryable", async () => {
  assert.equal((await listAll("users")).length, 1);
});

await check("insert returns the stored row with its generated id", () => {
  assert.match(user.id, /^[0-9a-f-]{36}$/);
  assert.equal(user.email, "check@local");
  assert.ok(user.createdAt, "createdAt should be set");
  assert.ok(user.updatedAt, "updatedAt should be set");
});

await check("numeric columns come back as numbers, not strings", async () => {
  const row = await findById("customers", customer.id);
  assert.equal(typeof row.creditLimit, "number");
  assert.equal(row.outstanding, 1234.56);
});

// --- the JSON round trip: the main Postgres→SQLite behaviour difference ---
const items = [
  { name: "TMT Bar 12mm", qty: 40, rate: 62.5, gstRate: 18 },
  { name: "Cement OPC 53", qty: 100, rate: 410, gstRate: 28 }
];
const sale = await insert("sales", {
  companyId: company.id, customerId: customer.id,
  documentType: "Tax Invoice", invoiceNumber: "INV-0001",
  invoiceDate: "2026-09-10", items,
  subtotal: 43500, cgst: 3915, sgst: 3915, total: 51330, status: "unpaid"
});

await check("JSON column returns a parsed array from insert", () => {
  assert.ok(Array.isArray(sale.items), `expected array, got ${typeof sale.items}`);
  assert.equal(sale.items[1].name, "Cement OPC 53");
});

await check("JSON column returns a parsed array from findById", async () => {
  const row = await findById("sales", sale.id);
  assert.ok(Array.isArray(row.items));
  assert.equal(row.items.length, 2);
  assert.equal(row.items[0].qty, 40);
});

await check("JSON column survives a round trip through update", async () => {
  const patched = await update("sales", sale.id, {
    items: [...items, { name: "Freight", qty: 1, rate: 900, gstRate: 18 }],
    total: 52230
  });
  assert.ok(Array.isArray(patched.items));
  assert.equal(patched.items.length, 3);
  assert.equal(patched.total, 52230);
});

await check("an already-stringified JSON payload is accepted too", async () => {
  const journal = await insert("journal_entries", {
    companyId: company.id, date: "2026-09-10", description: "Opening balance",
    entries: JSON.stringify([{ ledger: "Cash", debit: 10000, credit: 0 }])
  });
  assert.ok(Array.isArray(journal.entries));
  assert.equal(journal.entries[0].debit, 10000);
});

// --- filters --------------------------------------------------------------
await check("object filter builds a multi-param WHERE", async () => {
  const rows = await findWhere("sales", { companyId: company.id, status: "unpaid" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].invoiceNumber, "INV-0001");
  assert.equal((await findWhere("sales", { companyId: company.id, status: "paid" })).length, 0);
});

await check("legacy function predicate still filters, on parsed JSON", async () => {
  const rows = await findWhere("sales", (s) => s.items.some((i) => i.name === "Freight"));
  assert.equal(rows.length, 1);
});

await check("findOne with an object filter", async () => {
  const row = await findOne("sales", { invoiceNumber: "INV-0001" });
  assert.equal(row.id, sale.id);
  assert.equal(await findOne("sales", { invoiceNumber: "nope" }), null);
});

await check("findById on a missing id returns null, not a throw", async () => {
  assert.equal(await findById("sales", "does-not-exist"), null);
  assert.equal(await findById("sales", null), null);
});

// --- company template packing --------------------------------------------
await check("company terms and invoiceTemplate unpack separately", async () => {
  const row = await findById("companies", company.id);
  assert.equal(row.termsAndConditions, "Payment within 30 days");
  assert.equal(JSON.parse(row.invoiceTemplate).accent, "#0f172a");
});

await check("updating terms preserves the template", async () => {
  const patched = await update("companies", company.id, { termsAndConditions: "Net 15" });
  assert.equal(patched.termsAndConditions, "Net 15");
  assert.equal(JSON.parse(patched.invoiceTemplate).showBank, true);
});

// --- integrity ------------------------------------------------------------
await check("foreign keys are enforced", async () => {
  await assert.rejects(
    () => insert("sales", { companyId: "ghost-company", total: 1 }),
    /FOREIGN KEY|constraint/i
  );
});

await check("delete removes the row and writes an audit log", async () => {
  const doomed = await insert("customers", { companyId: company.id, name: "Temp Co" });
  await remove("customers", doomed.id, user.id);
  assert.equal(await findById("customers", doomed.id), null);
  const logs = await findWhere("audit_logs", { recordId: doomed.id, action: "DELETE" });
  assert.equal(logs.length, 1);
  // oldData is a JSON column, so it comes back already parsed.
  assert.equal(logs[0].oldData.name, "Temp Co");
});

const { closeDb } = await import(pathToFileURL(path.join(stagedLib, "db", "sqlite.js")).href);

await check("data persists across a close and reopen", async () => {
  closeDb();
  const row = await findById("sales", sale.id);
  assert.equal(row.invoiceNumber, "INV-0001");
  assert.equal(row.items.length, 3);
});

await check("statement cache survives finalizing a failed statement", async () => {
  // A constraint violation leaves its statement in an error state; closing
  // must not re-raise it. Regression guard for the finalize-throws bug.
  await assert.rejects(() => insert("customers", { companyId: "ghost", name: "X" }));
  assert.doesNotThrow(() => closeDb());
  assert.equal((await findById("sales", sale.id)).invoiceNumber, "INV-0001");
});

closeDb();

console.log(failures ? `\n${failures} check(s) failed\n` : "\nall checks passed\n");
process.exit(failures ? 1 : 0);
