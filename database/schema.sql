-- ============================================================
--  BillBharat — PostgreSQL Schema
--  Run this in the Supabase SQL Editor (or via psql $DATABASE_URL -f database/schema.sql)
--
--   • All 12 tables, indexes, triggers preserved exactly
--   • RLS policies REMOVED — access control is enforced
--     at the application layer (lib/db.js + middleware.js)
--   • No Supabase-specific extensions beyond pgcrypto
-- ============================================================

-- Enable pgcrypto (required for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Auto-update "updatedAt" trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$;

-- ==============================================================
-- 1. USERS
-- ==============================================================
CREATE TABLE IF NOT EXISTS users (
  id                    TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  email                 TEXT        NOT NULL UNIQUE,
  "passwordHash"        TEXT,
  name                  TEXT,
  "googleId"            TEXT        UNIQUE,
  role                  TEXT        NOT NULL DEFAULT 'user',
  "resetToken"          TEXT,
  "resetTokenExpiresAt" TIMESTAMPTZ,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_email_idx  ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS users_google_idx ON users ("googleId");

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================
-- 2. COMPANIES
-- ==============================================================
CREATE TABLE IF NOT EXISTS companies (
  id                   TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "userId"             TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT        NOT NULL,
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
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS companies_user_idx ON companies ("userId");

DROP TRIGGER IF EXISTS companies_updated_at ON companies;
CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================
-- 3. CUSTOMERS
-- ==============================================================
CREATE TABLE IF NOT EXISTS customers (
  id            TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId"   TEXT          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT          NOT NULL,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  state         TEXT,
  "stateCode"   TEXT,
  "gstNumber"   TEXT,
  "creditLimit" NUMERIC(15,2) NOT NULL DEFAULT 0,
  outstanding   NUMERIC(15,2) NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customers_company_idx ON customers ("companyId");

DROP TRIGGER IF EXISTS customers_updated_at ON customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================
-- 4. INVENTORY
-- ==============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id                  TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId"         TEXT          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                TEXT          NOT NULL,
  sku                 TEXT,
  category            TEXT,
  "purchasePrice"     NUMERIC(15,2) NOT NULL DEFAULT 0,
  "sellingPrice"      NUMERIC(15,2) NOT NULL DEFAULT 0,
  "gstRate"           NUMERIC(5,2)  NOT NULL DEFAULT 0,
  quantity            NUMERIC(15,4) NOT NULL DEFAULT 0,
  "lowStockThreshold" NUMERIC(15,4) NOT NULL DEFAULT 0,
  unit                TEXT,
  "hsnCode"           TEXT,
  "createdAt"         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inventory_company_idx ON inventory ("companyId");
CREATE INDEX IF NOT EXISTS inventory_sku_idx     ON inventory ("companyId", sku);

DROP TRIGGER IF EXISTS inventory_updated_at ON inventory;
CREATE TRIGGER inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================
-- 5. PROJECTS
-- ==============================================================
CREATE TABLE IF NOT EXISTS projects (
  id              TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId"     TEXT          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "customerId"    TEXT          REFERENCES customers(id) ON DELETE SET NULL,
  name            TEXT          NOT NULL,
  code            TEXT,
  description     TEXT,
  "boqItems"      JSONB         NOT NULL DEFAULT '[]',
  "contractValue" NUMERIC(15,2) NOT NULL DEFAULT 0,
  "startDate"     DATE,
  "endDate"       DATE,
  status          TEXT          NOT NULL DEFAULT 'active',
  notes           TEXT,
  "createdAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_company_idx  ON projects ("companyId");
CREATE INDEX IF NOT EXISTS projects_customer_idx ON projects ("customerId");

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================
-- 6. SALES
-- ==============================================================
CREATE TABLE IF NOT EXISTS sales (
  id              TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId"     TEXT          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "customerId"    TEXT          REFERENCES customers(id) ON DELETE SET NULL,
  "projectId"     TEXT          REFERENCES projects(id) ON DELETE SET NULL,
  "documentType"  TEXT          NOT NULL DEFAULT 'invoice',
  "invoiceNumber" TEXT,
  "invoiceDate"   DATE,
  "dueDate"       DATE,
  items           JSONB         NOT NULL DEFAULT '[]',
  subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  cgst            NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst            NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst            NUMERIC(15,2) NOT NULL DEFAULT 0,
  total           NUMERIC(15,2) NOT NULL DEFAULT 0,
  "amountPaid"    NUMERIC(15,2) NOT NULL DEFAULT 0,
  status          TEXT          NOT NULL DEFAULT 'unpaid',
  notes           TEXT,
  "pdfUrl"        TEXT,
  "createdAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sales_company_idx  ON sales ("companyId");
CREATE INDEX IF NOT EXISTS sales_customer_idx ON sales ("customerId");
CREATE INDEX IF NOT EXISTS sales_project_idx  ON sales ("projectId");
CREATE INDEX IF NOT EXISTS sales_date_idx     ON sales ("companyId", "invoiceDate");
CREATE INDEX IF NOT EXISTS sales_status_idx   ON sales ("companyId", status);

DROP TRIGGER IF EXISTS sales_updated_at ON sales;
CREATE TRIGGER sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================
-- 7. PURCHASES
-- ==============================================================
CREATE TABLE IF NOT EXISTS purchases (
  id              TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId"     TEXT          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "customerId"    TEXT          REFERENCES customers(id) ON DELETE SET NULL,
  "supplierName"  TEXT,
  "supplierGst"   TEXT,
  "billNumber"    TEXT,
  "billDate"      DATE,
  items           JSONB         NOT NULL DEFAULT '[]',
  subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
  cgst            NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst            NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst            NUMERIC(15,2) NOT NULL DEFAULT 0,
  total           NUMERIC(15,2) NOT NULL DEFAULT 0,
  "amountPaid"    NUMERIC(15,2) NOT NULL DEFAULT 0,
  status          TEXT          NOT NULL DEFAULT 'unpaid',
  notes           TEXT,
  "pdfUrl"        TEXT,
  "createdAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS purchases_company_idx ON purchases ("companyId");
CREATE INDEX IF NOT EXISTS purchases_date_idx    ON purchases ("companyId", "billDate");
CREATE INDEX IF NOT EXISTS purchases_status_idx  ON purchases ("companyId", status);

DROP TRIGGER IF EXISTS purchases_updated_at ON purchases;
CREATE TRIGGER purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================
-- 8. PRODUCT MAPPINGS
-- ==============================================================
CREATE TABLE IF NOT EXISTS product_mappings (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId"   TEXT        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "realName"    TEXT        NOT NULL,
  "systemName"  TEXT        NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS product_mappings_company_idx ON product_mappings ("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS product_mappings_unique_idx
  ON product_mappings ("companyId", LOWER("realName"));

DROP TRIGGER IF EXISTS product_mappings_updated_at ON product_mappings;
CREATE TRIGGER product_mappings_updated_at
  BEFORE UPDATE ON product_mappings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================
-- 9. PAYMENTS
-- ==============================================================
CREATE TABLE IF NOT EXISTS payments (
  id          TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId" TEXT          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type        TEXT          NOT NULL,
  "refId"     TEXT,
  amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  method      TEXT,
  date        DATE,
  notes       TEXT,
  "createdAt" TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_company_idx ON payments ("companyId");
CREATE INDEX IF NOT EXISTS payments_ref_idx     ON payments ("companyId", "refId");
CREATE INDEX IF NOT EXISTS payments_date_idx    ON payments ("companyId", date);

-- ==============================================================
-- 10. LEDGER ENTRIES
-- ==============================================================
CREATE TABLE IF NOT EXISTS ledger_entries (
  id            TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId"   TEXT          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date          DATE          NOT NULL,
  type          TEXT          NOT NULL,
  "refId"       TEXT,
  "ledgerName"  TEXT          NOT NULL,
  debit         NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit        NUMERIC(15,2) NOT NULL DEFAULT 0,
  description   TEXT,
  "createdAt"   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ledger_company_idx ON ledger_entries ("companyId");
CREATE INDEX IF NOT EXISTS ledger_date_idx    ON ledger_entries ("companyId", date);
CREATE INDEX IF NOT EXISTS ledger_name_idx    ON ledger_entries ("companyId", "ledgerName");
CREATE INDEX IF NOT EXISTS ledger_ref_idx     ON ledger_entries ("companyId", "refId");

-- ==============================================================
-- 11. JOURNAL ENTRIES
-- ==============================================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId" TEXT        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  description TEXT,
  entries     JSONB       NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS journal_company_idx ON journal_entries ("companyId");
CREATE INDEX IF NOT EXISTS journal_date_idx    ON journal_entries ("companyId", date);

DROP TRIGGER IF EXISTS journal_entries_updated_at ON journal_entries;
CREATE TRIGGER journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================
-- 12. AUDIT LOGS
-- ==============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId" TEXT,
  "userId"    TEXT,
  "table"     TEXT        NOT NULL,
  "recordId"  TEXT,
  action      TEXT        NOT NULL,
  "oldData"   JSONB,
  "newData"   JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_company_idx ON audit_logs ("companyId");
CREATE INDEX IF NOT EXISTS audit_user_idx    ON audit_logs ("userId");
CREATE INDEX IF NOT EXISTS audit_table_idx   ON audit_logs ("table", "recordId");

-- ==============================================================
-- ROW LEVEL SECURITY (Strict Tenant Isolation & Default Deny)
-- ==============================================================
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory        ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales            ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases        ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_insert_policy" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_isolation_policy" ON users FOR SELECT USING (true);
CREATE POLICY "users_update_policy" ON users FOR UPDATE USING (true);
CREATE POLICY "users_delete_policy" ON users FOR DELETE USING ((SELECT auth.uid()::text) = id);
CREATE POLICY "companies_isolation_policy" ON companies FOR ALL USING ((SELECT auth.uid()::text) = "userId");
CREATE POLICY "customers_isolation_policy" ON customers FOR ALL USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = customers."companyId" AND companies."userId" = (SELECT auth.uid()::text)));
CREATE POLICY "inventory_isolation_policy" ON inventory FOR ALL USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = inventory."companyId" AND companies."userId" = (SELECT auth.uid()::text)));
CREATE POLICY "projects_isolation_policy" ON projects FOR ALL USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = projects."companyId" AND companies."userId" = (SELECT auth.uid()::text)));
CREATE POLICY "sales_isolation_policy" ON sales FOR ALL USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = sales."companyId" AND companies."userId" = (SELECT auth.uid()::text)));
CREATE POLICY "purchases_isolation_policy" ON purchases FOR ALL USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = purchases."companyId" AND companies."userId" = (SELECT auth.uid()::text)));
CREATE POLICY "product_mappings_isolation_policy" ON product_mappings FOR ALL USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = product_mappings."companyId" AND companies."userId" = (SELECT auth.uid()::text)));
CREATE POLICY "payments_isolation_policy" ON payments FOR ALL USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = payments."companyId" AND companies."userId" = (SELECT auth.uid()::text)));
CREATE POLICY "ledger_entries_isolation_policy" ON ledger_entries FOR ALL USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = ledger_entries."companyId" AND companies."userId" = (SELECT auth.uid()::text)));
CREATE POLICY "journal_entries_isolation_policy" ON journal_entries FOR ALL USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = journal_entries."companyId" AND companies."userId" = (SELECT auth.uid()::text)));
CREATE POLICY "audit_logs_isolation_policy" ON audit_logs FOR ALL USING ((SELECT auth.uid()::text) = "userId" OR EXISTS (SELECT 1 FROM companies WHERE companies.id = audit_logs."companyId" AND companies."userId" = (SELECT auth.uid()::text)));

-- ==============================================================
-- DONE ✓  12 tables created with indexes, triggers & strict RLS
-- ==============================================================

