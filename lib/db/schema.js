/**
 * lib/db/schema.js — SQLite schema, inlined as a string.
 *
 * Inlined rather than read from a .sql file so the packaged exe has no
 * runtime file lookup to get wrong. Applied on every open (all statements
 * are IF NOT EXISTS), which doubles as the migration path for new installs.
 *
 * Postgres → SQLite type mapping:
 *   TIMESTAMPTZ / DATE → TEXT (ISO strings)
 *   NUMERIC(x,y)       → REAL
 *   JSONB              → TEXT (parsed back to objects in lib/db.js)
 *
 * Dropped from the Postgres version: pgcrypto (ids come from randomUUID in
 * lib/db.js), set_updated_at triggers (lib/db.js writes updatedAt itself),
 * and RLS policies (single-user local app; access checks live in lib/db.js).
 */

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id                    TEXT PRIMARY KEY,
  email                 TEXT NOT NULL UNIQUE,
  "passwordHash"        TEXT,
  name                  TEXT,
  "googleId"            TEXT UNIQUE,
  role                  TEXT NOT NULL DEFAULT 'user',
  "resetToken"          TEXT,
  "resetTokenExpiresAt" TEXT,
  "createdAt"           TEXT NOT NULL,
  "updatedAt"           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS users_email_idx  ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS users_google_idx ON users ("googleId");

CREATE TABLE IF NOT EXISTS companies (
  id                   TEXT PRIMARY KEY,
  "userId"             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  "logoUrl"            TEXT,
  address              TEXT,
  city                 TEXT,
  state                TEXT,
  "stateCode"          TEXT,
  pincode              TEXT,
  "gstNumber"          TEXT,
  "panNumber"          TEXT,
  "bankAccountNo"      TEXT,
  "bankIfsc"           TEXT,
  "bankName"           TEXT,
  "bankBranch"         TEXT,
  "termsAndConditions" TEXT,
  phone                TEXT,
  email                TEXT,
  "createdAt"          TEXT NOT NULL,
  "updatedAt"          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS companies_user_idx ON companies ("userId");

CREATE TABLE IF NOT EXISTS customers (
  id            TEXT PRIMARY KEY,
  "companyId"   TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  state         TEXT,
  "stateCode"   TEXT,
  "gstNumber"   TEXT,
  "creditLimit" REAL NOT NULL DEFAULT 0,
  outstanding   REAL NOT NULL DEFAULT 0,
  "createdAt"   TEXT NOT NULL,
  "updatedAt"   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS customers_company_idx ON customers ("companyId");
CREATE INDEX IF NOT EXISTS customers_name_idx    ON customers ("companyId", name);

CREATE TABLE IF NOT EXISTS inventory (
  id                  TEXT PRIMARY KEY,
  "companyId"         TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  sku                 TEXT,
  category            TEXT,
  "purchasePrice"     REAL NOT NULL DEFAULT 0,
  "sellingPrice"      REAL NOT NULL DEFAULT 0,
  "gstRate"           REAL NOT NULL DEFAULT 0,
  quantity            REAL NOT NULL DEFAULT 0,
  "lowStockThreshold" REAL NOT NULL DEFAULT 0,
  unit                TEXT,
  "hsnCode"           TEXT,
  "createdAt"         TEXT NOT NULL,
  "updatedAt"         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inventory_company_idx ON inventory ("companyId");
CREATE INDEX IF NOT EXISTS inventory_sku_idx     ON inventory ("companyId", sku);
CREATE INDEX IF NOT EXISTS inventory_name_idx    ON inventory ("companyId", name);

CREATE TABLE IF NOT EXISTS projects (
  id              TEXT PRIMARY KEY,
  "companyId"     TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "customerId"    TEXT REFERENCES customers(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  code            TEXT,
  description     TEXT,
  "boqItems"      TEXT NOT NULL DEFAULT '[]',
  "contractValue" REAL NOT NULL DEFAULT 0,
  "startDate"     TEXT,
  "endDate"       TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  notes           TEXT,
  "createdAt"     TEXT NOT NULL,
  "updatedAt"     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS projects_company_idx  ON projects ("companyId");
CREATE INDEX IF NOT EXISTS projects_customer_idx ON projects ("customerId");

CREATE TABLE IF NOT EXISTS sales (
  id              TEXT PRIMARY KEY,
  "companyId"     TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "customerId"    TEXT REFERENCES customers(id) ON DELETE SET NULL,
  "projectId"     TEXT REFERENCES projects(id) ON DELETE SET NULL,
  "documentType"  TEXT NOT NULL DEFAULT 'invoice',
  "invoiceNumber" TEXT,
  "invoiceDate"   TEXT,
  "dueDate"       TEXT,
  items           TEXT NOT NULL DEFAULT '[]',
  subtotal        REAL NOT NULL DEFAULT 0,
  discount        REAL NOT NULL DEFAULT 0,
  cgst            REAL NOT NULL DEFAULT 0,
  sgst            REAL NOT NULL DEFAULT 0,
  igst            REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL DEFAULT 0,
  "amountPaid"    REAL NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'unpaid',
  notes           TEXT,
  "pdfUrl"        TEXT,
  "createdAt"     TEXT NOT NULL,
  "updatedAt"     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sales_company_idx  ON sales ("companyId");
CREATE INDEX IF NOT EXISTS sales_customer_idx ON sales ("customerId");
CREATE INDEX IF NOT EXISTS sales_project_idx  ON sales ("projectId");
CREATE INDEX IF NOT EXISTS sales_date_idx     ON sales ("companyId", "invoiceDate");
CREATE INDEX IF NOT EXISTS sales_status_idx   ON sales ("companyId", status);

CREATE TABLE IF NOT EXISTS purchases (
  id             TEXT PRIMARY KEY,
  "companyId"    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "customerId"   TEXT REFERENCES customers(id) ON DELETE SET NULL,
  "supplierName" TEXT,
  "supplierGst"  TEXT,
  "billNumber"   TEXT,
  "billDate"     TEXT,
  items          TEXT NOT NULL DEFAULT '[]',
  subtotal       REAL NOT NULL DEFAULT 0,
  cgst           REAL NOT NULL DEFAULT 0,
  sgst           REAL NOT NULL DEFAULT 0,
  igst           REAL NOT NULL DEFAULT 0,
  total          REAL NOT NULL DEFAULT 0,
  "amountPaid"   REAL NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'unpaid',
  notes          TEXT,
  "pdfUrl"       TEXT,
  "createdAt"    TEXT NOT NULL,
  "updatedAt"    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS purchases_company_idx  ON purchases ("companyId");
CREATE INDEX IF NOT EXISTS purchases_date_idx     ON purchases ("companyId", "billDate");
CREATE INDEX IF NOT EXISTS purchases_status_idx   ON purchases ("companyId", status);
CREATE INDEX IF NOT EXISTS purchases_supplier_idx ON purchases ("companyId", "supplierName");

CREATE TABLE IF NOT EXISTS product_mappings (
  id           TEXT PRIMARY KEY,
  "companyId"  TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "realName"   TEXT NOT NULL,
  "systemName" TEXT NOT NULL,
  "createdAt"  TEXT NOT NULL,
  "updatedAt"  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS product_mappings_company_idx ON product_mappings ("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS product_mappings_unique_idx
  ON product_mappings ("companyId", LOWER("realName"));

CREATE TABLE IF NOT EXISTS payments (
  id          TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  "refId"     TEXT,
  amount      REAL NOT NULL DEFAULT 0,
  method      TEXT,
  date        TEXT,
  notes       TEXT,
  "createdAt" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS payments_company_idx ON payments ("companyId");
CREATE INDEX IF NOT EXISTS payments_ref_idx     ON payments ("companyId", "refId");
CREATE INDEX IF NOT EXISTS payments_date_idx    ON payments ("companyId", date);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id           TEXT PRIMARY KEY,
  "companyId"  TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  type         TEXT NOT NULL,
  "refId"      TEXT,
  "ledgerName" TEXT NOT NULL,
  debit        REAL NOT NULL DEFAULT 0,
  credit       REAL NOT NULL DEFAULT 0,
  description  TEXT,
  "createdAt"  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_company_idx ON ledger_entries ("companyId");
CREATE INDEX IF NOT EXISTS ledger_date_idx    ON ledger_entries ("companyId", date);
CREATE INDEX IF NOT EXISTS ledger_name_idx    ON ledger_entries ("companyId", "ledgerName");
CREATE INDEX IF NOT EXISTS ledger_ref_idx     ON ledger_entries ("companyId", "refId");

CREATE TABLE IF NOT EXISTS journal_entries (
  id          TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  description TEXT,
  entries     TEXT NOT NULL DEFAULT '[]',
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS journal_company_idx ON journal_entries ("companyId");
CREATE INDEX IF NOT EXISTS journal_date_idx    ON journal_entries ("companyId", date);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  "companyId" TEXT,
  "userId"    TEXT,
  "table"     TEXT NOT NULL,
  "recordId"  TEXT,
  action      TEXT NOT NULL,
  "oldData"   TEXT,
  "newData"   TEXT,
  "createdAt" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_company_idx ON audit_logs ("companyId");
CREATE INDEX IF NOT EXISTS audit_user_idx    ON audit_logs ("userId");
CREATE INDEX IF NOT EXISTS audit_table_idx   ON audit_logs ("table", "recordId");
`;
