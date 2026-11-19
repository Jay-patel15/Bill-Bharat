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
const LAYER = ["paths.js", "db.js", "db/schema.js", "db/sqlite.js", "gst.js", "gst-export.js", "utils.js", "accounting.js", "outstanding.js", "invoice-template.js"];

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
  insert, update, remove, query, transaction, customerDues,
  findById, findOne, findWhere, listAll,
  getSetting, setSetting, deleteSetting
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


// --- fixtures, in FK order ------------------------------------------------
const user = await insert("users", {
  email: "check@local", passwordHash: "x", name: "Checker", role: "admin"
});
const company = await insert("companies", {
  userId: user.id, name: "Acme Traders", gstNumber: "24AAAAA0000A1Z5",
  termsAndConditions: "Payment within 30 days"
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

await check("function predicates are refused (they were full-table scans)", async () => {
  await assert.rejects(() => findWhere("sales", () => true), /object filter/);
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

// --- company terms ----------------------------------------------------------
await check("company terms are stored and updated as plain text", async () => {
  assert.equal((await findById("companies", company.id)).termsAndConditions, "Payment within 30 days");
  const patched = await update("companies", company.id, { termsAndConditions: "Net 15" });
  assert.equal(patched.termsAndConditions, "Net 15");
});

await check("terms saved by older builds (JSON with template) are unwrapped", async () => {
  const legacy = JSON.stringify({ termsAndConditions: "Old terms", invoiceTemplate: { accent: "#000" } });
  await query(`UPDATE companies SET "termsAndConditions" = $1 WHERE id = $2`, [legacy, company.id]);
  assert.equal((await findById("companies", company.id)).termsAndConditions, "Old terms");
});

// --- app_settings key-value store ----------------------------------------
await check("app_settings get/set/delete cycle", async () => {
  await setSetting("test_key", "test_val_1");
  assert.equal(await getSetting("test_key"), "test_val_1");
  await setSetting("test_key", "test_val_2");
  assert.equal(await getSetting("test_key"), "test_val_2");
  await deleteSetting("test_key");
  assert.equal(await getSetting("test_key"), null);
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

// --- transactions, columns, computed balances -----------------------------
await check("a failed transaction leaves no partial writes", async () => {
  await assert.rejects(() => transaction(async () => {
    await insert("customers", { companyId: company.id, name: "Half Saved" });
    throw new Error("boom");
  }), /boom/);
  assert.equal(await findOne("customers", { name: "Half Saved" }), null);
});

await check("nested transactions join the outer one", async () => {
  await transaction(async () => {
    await transaction(() => insert("customers", { companyId: company.id, name: "Nested" }));
  });
  assert.ok(await findOne("customers", { name: "Nested" }));
});

await check("unknown column names are refused before reaching SQL", async () => {
  await assert.rejects(() => insert("customers", { companyId: company.id, name: "X", 'bad" = 1 --': 1 }), /Unknown column/);
  await assert.rejects(() => findWhere("sales", { nope: 1 }), /Unknown column/);
});

await check("customer dues come from Tax Invoices, not the stored counter", async () => {
  await insert("sales", { companyId: company.id, customerId: customer.id, documentType: "Quotation", invoiceNumber: "QT-1", total: 9999 });
  // fixture sale: total 51330 (later patched to 52230), nothing paid
  const due = (await customerDues(company.id)).get(customer.id);
  assert.equal(due, 52230);
});

await check("a reused $n placeholder binds the same value", async () => {
  const rows = await query(`SELECT $1 AS a, $2 AS b, $1 AS c`, ["x", "y"]);
  assert.deepEqual(rows[0], { a: "x", b: "y", c: "x" });
});

await check("migrations are recorded once", async () => {
  const rows = await query("SELECT version FROM _schema_migrations ORDER BY version");
  assert.deepEqual(rows.map((r) => r.version), [1, 2, 3, 4]);
});

const { closeDb, snapshot, restoreFrom } = await import(pathToFileURL(path.join(stagedLib, "db", "sqlite.js")).href);

await check("snapshot writes a checksummed copy and restore brings it back", async () => {
  const file = snapshot(undefined, "check");
  const sum = fs.readFileSync(`${file}.sha256`, "utf8").split(" ")[0];
  const real = (await import("node:crypto")).createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  assert.equal(sum, real);
  await insert("customers", { companyId: company.id, name: "After Snapshot" });
  restoreFrom(file);
  assert.equal(await findOne("customers", { name: "After Snapshot" }), null);
  assert.ok(await findById("sales", sale.id));
});

await check("backups pack uploaded files, copy to extra folders, survive a missing folder, and restore the files", async () => {
  const sq = await import(pathToFileURL(path.join(stagedLib, "db", "sqlite.js")).href);
  const { filesDir } = await import(pathToFileURL(path.join(stagedLib, "paths.js")).href);
  fs.mkdirSync(path.join(filesDir(), "logos"), { recursive: true });
  fs.writeFileSync(path.join(filesDir(), "logos", "logo.png"), "PNGDATA");
  const offsite = path.join(tmp, "gdrive");
  const missing = path.join(tmp, "nofile.txt", "sub"); // parent is a file: mkdir fails like an unplugged pen drive
  fs.writeFileSync(path.join(tmp, "nofile.txt"), "x");
  sq.setBackupFolders([offsite, missing]);

  const file = sq.dailyBackup();
  assert.ok(file && path.basename(file).startsWith("daily_"));
  assert.equal(sq.dailyBackup(), null, "only one daily backup per day");
  await sq.offsiteIdle(); // folder copies run in the background
  assert.ok(fs.existsSync(path.join(offsite, path.basename(file))) && fs.existsSync(path.join(offsite, `${path.basename(file)}.sha256`)));
  const st = sq.backupStatus();
  assert.ok(st.lastOffsite && st.lastOffsiteError.includes("nofile.txt"));

  fs.rmSync(path.join(filesDir(), "logos", "logo.png"));
  sq.restoreFrom(path.join(offsite, path.basename(file)));
  assert.equal(fs.readFileSync(path.join(filesDir(), "logos", "logo.png"), "utf8"), "PNGDATA");
  assert.deepEqual(sq.backupFolders(), [offsite, missing], "folders are a setting of this PC, kept across restore");
  assert.equal((await query("SELECT name FROM sqlite_master WHERE name = '_backup_files'")).length, 0);
  sq.setBackupFolders([]);
});

await check("restore never writes packed files outside the files folder", async () => {
  const sq = await import(pathToFileURL(path.join(stagedLib, "db", "sqlite.js")).href);
  const file = snapshot(undefined, "crafted");
  const { default: sqlite3 } = await import("node-sqlite3-wasm");
  const d = new sqlite3.Database(file);
  d.run("INSERT INTO _backup_files (path, data) VALUES (?, ?)", ["../../evil.txt", new Uint8Array([1])]);
  d.close();
  sq.restoreFrom(file);
  assert.equal(fs.existsSync(path.resolve(tmp, "files", "..", "..", "evil.txt")), false);
});

await check("restore refuses a file that is not a database", async () => {
  const junk = path.join(tmp, "junk.db");
  fs.writeFileSync(junk, "hello");
  assert.throws(() => restoreFrom(junk), /Not a BillBharat backup/);
});

// --- money flows ------------------------------------------------------------
const acc = await import(pathToFileURL(path.join(stagedLib, "accounting.js")).href);
const { outstandingStatement, partyStatement, partiesWithBills } = await import(pathToFileURL(path.join(stagedLib, "outstanding.js")).href);
const ledgerOf = async (refId) => findWhere("ledger_entries", { companyId: company.id, refId });
const balanced = (lines) => Math.abs(lines.reduce((s, l) => s + l.debit - l.credit, 0)) < 0.005;

await check("addPayment books two balanced lines and recomputes paid/status from all payments", async () => {
  const inv = await insert("sales", { companyId: company.id, customerId: customer.id, documentType: "Tax Invoice", invoiceNumber: "INV-PAY", total: 1000 });
  const first = await transaction(() => acc.addPayment("SALE", inv, { amount: 400, method: "UPI" }));
  assert.deepEqual([first.doc.amountPaid, first.doc.status], [400, "Partially Paid"]);
  const lines = await ledgerOf(first.payment.id);
  assert.equal(lines.length, 2);
  assert.ok(balanced(lines));
  assert.ok(lines.some((l) => l.ledgerName === "UPI" && l.debit === 400));
  const second = await transaction(() => acc.addPayment("SALE", inv, { amount: 600 }));
  assert.deepEqual([second.doc.amountPaid, second.doc.status], [1000, "Paid"]);
});

await check("supplier outstanding groups unpaid bills by supplier name and skips drafts and paid bills", async () => {
  const bill = (supplierName, total, amountPaid, status = "Unpaid") =>
    insert("purchases", { companyId: company.id, supplierName, billNumber: `B-${total}`, billDate: "2026-09-01", total, amountPaid, status });
  await bill("Shree Steel", 1000, 200);
  await bill("shree steel ", 500, 0);
  await bill("Paid Co", 300, 300, "Paid");
  await bill("Draft Co", 900, 0, "Draft");
  const st = await outstandingStatement(company.id, "suppliers");
  assert.equal(st.totalParties, 1);
  assert.equal(st.parties[0].rows.length, 2);
  assert.equal(st.totalAmount, 1300);
  assert.ok(st.parties[0].rows[0].overdueDays > 0);
});

await check("customer outstanding ignores quotations and paid invoices", async () => {
  const st = await outstandingStatement(company.id, "customers");
  const refs = st.parties.flatMap((p) => p.rows.map((r) => r.refNo));
  assert.ok(refs.includes("INV-0001"));
  assert.ok(!refs.includes("QT-1") && !refs.includes("INV-PAY") && !refs.includes("INV-GUARD"));
});

await check("party ledger: running balance with opening balance, all bills or only chosen ones", async () => {
  const sup = await insert("purchases", { companyId: company.id, supplierName: "Ledger Co", billNumber: "L-1", billDate: "2026-08-10", total: 1000, amountPaid: 0, status: "Unpaid" });
  const sup2 = await insert("purchases", { companyId: company.id, supplierName: "ledger co", billNumber: "L-2", billDate: "2026-09-05", total: 500, amountPaid: 0, status: "Unpaid" });
  await transaction(() => acc.addPayment("PURCHASE", sup, { amount: 600, date: "2026-09-01", method: "Cheque" }));

  const all = await partyStatement(company.id, "suppliers", "ledger co", "", "");
  assert.deepEqual(all.invoices.map((b) => [b.refNo, b.amount, b.balance]), [["L-1", 1000, 400], ["L-2", 500, 500]]);
  assert.deepEqual(all.ids, []);
  assert.deepEqual(all.ledger.map((e) => e.balance), [1000, 400, 900]);
  assert.equal(all.closing, 900);

  const sept = await partyStatement(company.id, "suppliers", "ledger co", "2026-09-01", "2026-09-30");
  assert.equal(sept.opening, 1000);
  assert.deepEqual(sept.ledger.map((e) => [e.debit, e.credit, e.balance]), [[0, 600, 400], [500, 0, 900]]);
  assert.equal(sept.invoices.length, 2);

  const onlyL2 = await partyStatement(company.id, "suppliers", "ledger co", "", "", [sup2.id]);
  assert.deepEqual(onlyL2.ledger.map((e) => [e.refNo, e.balance]), [["L-2", 500]]);
  assert.deepEqual(onlyL2.ids, [sup2.id]);
  const both = await partyStatement(company.id, "suppliers", "ledger co", "", "", [sup.id, sup2.id]);
  assert.equal(both.closing, 900);
  assert.ok((await partiesWithBills(company.id, "suppliers")).some((p) => p.key === "ledger co" && p.balance === 900));
  assert.equal(await partyStatement(company.id, "suppliers", "nobody", "", ""), null);
});

// --- invoice template -----------------------------------------------------
const { mergeTemplate, DEFAULT_TEMPLATE } = await import(pathToFileURL(path.join(stagedLib, "invoice-template.js")).href);

await check("invoice template: defaults fill gaps, junk keys and wrong types are dropped, text is clamped", () => {
  assert.deepEqual(mergeTemplate(null), DEFAULT_TEMPLATE);
  const t = mergeTemplate({ show: { hsn: false, logo: "yes", evil: true }, labels: { hsn: "HSN/SAC", x: "y" },
    text: { reverseCharge: "Maybe", declaration: "a".repeat(5000), terms: "gone" }, extra: 1 });
  assert.equal(t.show.hsn, false);
  assert.equal(t.show.logo, true);
  assert.equal("evil" in t.show, false);
  assert.equal(t.labels.hsn, "HSN/SAC");
  assert.equal("x" in t.labels, false);
  assert.equal(t.text.reverseCharge, "No");
  assert.equal(t.text.declaration.length, 600);
  assert.equal("terms" in t.text, false); // terms live on the company, not the template
  assert.equal("extra" in t, false);
  assert.equal(mergeTemplate({ text: { numberFormat: "  " } }).text.numberFormat, DEFAULT_TEMPLATE.text.numberFormat);
});

const { nextInvoiceNumber, DEFAULT_NUMBER_FORMAT } = await import(pathToFileURL(path.join(stagedLib, "utils.js")).href);

await check("invoice number format: default series, custom tokens, restart per period, counter appended if missing", () => {
  assert.equal(DEFAULT_NUMBER_FORMAT, DEFAULT_TEMPLATE.text.numberFormat);
  // Default: one series per Indian financial year, not per month.
  const fyNos = ["INV/26-27/0041", "INV/26-27/0042", "PO/26-27/0009", "INV/25-26/0100"];
  assert.equal(nextInvoiceNumber(fyNos, "INV", undefined, "2026-11-01"), "INV/26-27/0043", "new month keeps counting");
  assert.equal(nextInvoiceNumber(fyNos, "INV", undefined, "2027-03-31"), "INV/26-27/0043", "31 March is still FY 26-27");
  assert.equal(nextInvoiceNumber(fyNos, "INV", undefined, "2027-04-01"), "INV/27-28/0001", "1 April starts the new year");
  assert.equal(nextInvoiceNumber(fyNos, "PO", undefined, "2026-11-01"), "PO/26-27/0010");
  assert.equal(mergeTemplate({ text: { numberFormat: "{PREFIX}-{YYYY}{MM}-{####}" } }).text.numberFormat, DEFAULT_NUMBER_FORMAT, "old monthly default upgraded");
  const old = ["INV-202610-0041", "INV-202610-0042"];
  assert.equal(nextInvoiceNumber(old, "INV", "{PREFIX}-{YYYY}{MM}-{####}", "2026-11-01"), "INV-202611-0001", "monthly still possible if chosen");
  const fy = ["INV/26-27/007", "INV/25-26/050"];
  assert.equal(nextInvoiceNumber(fy, "INV", "{PREFIX}/{FY}/{###}", "2026-10-01"), "INV/26-27/008");
  assert.equal(nextInvoiceNumber(fy, "INV", "{PREFIX}/{FY}/{###}", "2026-03-31"), "INV/25-26/051");
  assert.equal(nextInvoiceNumber(["A-9 (x)"], "INV", "A-{#} (x)", "2026-10-01"), "A-10 (x)");
  assert.equal(nextInvoiceNumber(["SHOP-0012"], "INV", "SHOP", "2026-10-01"), "SHOP-0013");
});

// --- GST math ---------------------------------------------------------------
const { computeInvoice } = await import(pathToFileURL(path.join(stagedLib, "gst.js")).href);
const { generateGSTR1 } = await import(pathToFileURL(path.join(stagedLib, "gst-export.js")).href);
const line = { quantity: 1, sellingPrice: 1000, gstRate: 18 };

await check("interstate supply charges IGST only", () => {
  const c = computeInvoice({ items: [line], supplierStateCode: "24", recipientStateCode: "29" });
  assert.deepEqual([c.igst, c.cgst, c.sgst, c.grandTotal], [180, 0, 0, 1180]);
});

await check("same-state supply splits CGST and SGST", () => {
  const c = computeInvoice({ items: [line], supplierStateCode: "24", recipientStateCode: "24" });
  assert.deepEqual([c.igst, c.cgst, c.sgst, c.grandTotal], [0, 90, 90, 1180]);
});

await check("invoice discount lowers the taxable value before tax", () => {
  const c = computeInvoice({ items: [line], supplierStateCode: "24", recipientStateCode: "24", invoiceDiscount: 100 });
  assert.deepEqual([c.gross, c.subtotal, c.cgst + c.sgst, c.grandTotal], [1000, 900, 162, 1062]);
});

await check("invoice discount is spread over lines and adds up exactly", () => {
  const items = [{ quantity: 3, sellingPrice: 333.33, gstRate: 18 }, { quantity: 1, sellingPrice: 250, gstRate: 5 }];
  const c = computeInvoice({ items, supplierStateCode: "24", recipientStateCode: "24", invoiceDiscount: 100 });
  assert.equal(Math.round((c.gross - c.subtotal) * 100) / 100, 100);
  assert.equal(c.items.reduce((s, it) => s + it.invoiceDiscountShare, 0).toFixed(2), "100.00");
});

await check("sales total rounds to the rupee and the sale voucher still balances", async () => {
  const c = computeInvoice({ items: [{ quantity: 3, sellingPrice: 333.33, gstRate: 18 }], supplierStateCode: "24", recipientStateCode: "24", roundToRupee: true });
  assert.equal(c.grandTotal, 1180);
  assert.equal(c.roundOff, 0.01);
  const sale = await insert("sales", { companyId: company.id, customerId: customer.id, documentType: "Tax Invoice", invoiceNumber: "INV-RND",
    subtotal: c.subtotal, cgst: c.cgst, sgst: c.sgst, igst: c.igst, discount: 0, total: c.grandTotal });
  await transaction(() => acc.recordSaleAccounting(sale, "Bharat Steel"));
  const lines = await ledgerOf(sale.id);
  assert.ok(balanced(lines), JSON.stringify(lines.map((l) => [l.ledgerName, l.debit, l.credit])));
  assert.ok(lines.some((l) => l.ledgerName === "Round Off" && l.credit === 0.01));
});

await check("GSTR-1 puts registered buyers in B2B and others in B2CS", () => {
  const inv = (n, customerId) => ({ documentType: "Tax Invoice", invoiceNumber: n, invoiceDate: "2026-09-10", customerId, total: 1180, items: [{ gstRate: 18, taxable: 1000, igst: 180 }] });
  const customers = new Map([["b2b", { gstNumber: "29ABCDE1234F1Z5" }], ["b2c", { stateCode: "29" }]]);
  const out = generateGSTR1({ gstNumber: "24AAAAA0000A1Z5", stateCode: "24" }, [inv("A", "b2b"), inv("B", "b2b"), inv("C", "b2c")], customers, "2026-09");
  assert.equal(out.fp, "092026");
  assert.equal(out.b2b.length, 1);
  assert.equal(out.b2b[0].inv.length, 2);
  assert.equal(out.b2b[0].inv[0].pos, "29");
  assert.deepEqual([out.b2cs.length, out.b2cs[0].sply_ty, out.b2cs[0].txval], [1, "INTER", 1000]);
});


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

// Last: it empties the books.
await check("erase all books removes every company's data and files but keeps the login and app settings", async () => {
  const { eraseAllBooks } = await import(pathToFileURL(path.join(stagedLib, "db.js")).href);
  const { filesDir } = await import(pathToFileURL(path.join(stagedLib, "paths.js")).href);
  await setSetting("gemini_key", "keep-me");
  await setSetting(`invoice_template:${company.id}`, "{}");
  fs.writeFileSync(path.join(filesDir(), "x.png"), "x");
  const usersBefore = (await query("SELECT COUNT(*) AS n FROM users"))[0].n;
  await eraseAllBooks();
  for (const t of ["companies", "customers", "inventory", "sales", "purchases", "payments", "ledger_entries", "audit_logs"]) {
    assert.equal((await query(`SELECT COUNT(*) AS n FROM "${t}"`))[0].n, 0, `${t} emptied`);
  }
  assert.equal((await query("SELECT COUNT(*) AS n FROM users"))[0].n, usersBefore);
  assert.equal(await getSetting("gemini_key"), "keep-me");
  assert.equal(await getSetting(`invoice_template:${company.id}`), null);
  assert.deepEqual(fs.readdirSync(filesDir()), []);
});

closeDb();

console.log(failures ? `\n${failures} check(s) failed\n` : "\nall checks passed\n");
process.exit(failures ? 1 : 0);
