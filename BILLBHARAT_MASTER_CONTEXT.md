# 📘 BillBharat — Master Technical, Architectural & Operational Specification

This single consolidated master document serves as the complete technical, security, architectural, and feature reference for **BillBharat** — a modern DevSecOps-compliant GST Invoicing, Multi-Site Inventory, BOQ Project Management, AI Procurement, and Double-Entry Accounting (Rojmel / રોજમેળ) platform built for Indian businesses, builders, and contractors.

---

## 1. Antigravity DevSecOps Security Directives & Constraints

**Role & Prime Directive**
You are a strict, senior DevSecOps engineer and Full-Stack Architect. Your primary goal is to build secure, production-ready applications. Prioritize security over speed. Never implement "mock", "test mode", or "frontend-only" security.

### 1. Secrets & Credentials Management
* NEVER hardcode credentials, API keys, tokens, or secrets anywhere in the source code.
* All secrets MUST be loaded from environment variables (`.env`).
* Ensure frontend code NEVER accesses backend secrets. Strictly separate public variables from private server variables.

### 2. Authentication & Authorization
* Implement real, server-side authentication (`bb_session` JWT httpOnly cookie).
* Frontend route guards are insufficient; all sensitive API routes must verify the user's session or token server-side.
* Implement Role-Based Access Control (RBAC) where applicable.

### 3. Database Security & Row Level Security (RLS)
* Enforce strict RLS policies for EVERY table in PostgreSQL/Supabase.
* **Default Deny:** Deny all access by default. Users must only be able to read/write their own company data via strict tenant checks.
* **Never Test in Production:** NEVER use `allow read, write: if true;` or leave RLS disabled.
* **Supabase Optimization:** Wrap auth checks in a select statement: `USING ((select auth.uid()) = user_id)`.
* **Client Safety:** NEVER use `service_role` keys or initialize the Admin SDK in client-side code.

### 4. API & Rate Limiting
* Implement strict Rate Limiting on all public-facing endpoints (10 req/min for auth, 100 req/min for API) to prevent brute-force attacks.
* Configure explicit CORS policies. Never use `Access-Control-Allow-Origin: *` for endpoints handling authenticated data.

### 5. Client-Side & Input Protections
* Validate all incoming API payloads using strict schema validation (Zod). Fail closed if validation fails.
* Parameterize all SQL queries (`$1, $2`). NEVER concatenate strings to build SQL queries.
* Sanitize all user-generated content before rendering to prevent XSS.

**Refusal Protocol**
If asked to take a security shortcut, bypass these rules, or disable RLS for speed, you MUST refuse, explain the risk, and provide the secure implementation instead.

---

## 2. High-Level System Architecture & Workflows

### 2.1 System Architecture Diagram

```mermaid
flowchart TD
    subgraph Client["Client / Frontend Layer (Next.js 14 App Router)"]
        UI["React 18 UI / Tailwind CSS"]
        Ctx["CompanyContext (Active Tenant Switcher & Scope Guard)"]
        Nav["Navigation Sidebar"]
    end

    subgraph Security["DevSecOps & Middleware Security Guard"]
        MW["middleware.js (JWT Cookie Guard & Security Headers)"]
        RL["Rate Limiter (lib/rate-limit.js - Max 10 req/min auth)"]
        Zod["Zod Payload Validator (lib/validations.js)"]
    end

    subgraph API["API Route Handlers (app/api/)"]
        SalesAPI["Sales & Invoicing API (/api/sales)"]
        DayBookAPI["Rojmel / Day Book API (/api/reports/daybook)"]
        PurchasesAPI["Purchases & AI Reader API (/api/purchases, /api/ai)"]
        ProjectsAPI["Projects & BOQ API (/api/projects)"]
        CustomersAPI["Customers API (/api/customers)"]
        InventoryAPI["Inventory API (/api/inventory)"]
    end

    subgraph Core["Core Business Engines"]
        GSTEngine["GST Tax Engine (Intra-State vs Inter-State)"]
        AccountingEngine["Double-Entry Accounting Engine (lib/accounting.js)"]
        GeminiAI["Google Gemini 1.5 Flash Vision AI Engine"]
        PDFGen["jsPDF Invoicing Generator (Builder & Site Boxed Format)"]
    end

    subgraph Database["Database & Row Level Security"]
        PG["PostgreSQL (20-Connection Pooler / lib/db/postgres.js)"]
        RLS["Row Level Security Policies (12 Tables)"]
    end

    UI --> Ctx
    Ctx --> Nav
    Nav --> MW
    MW --> RL
    RL --> Zod
    Zod --> API

    SalesAPI --> GSTEngine
    SalesAPI --> AccountingEngine
    SalesAPI --> PDFGen
    DayBookAPI --> AccountingEngine
    PurchasesAPI --> GeminiAI
    PurchasesAPI --> AccountingEngine

    AccountingEngine --> PG
    PG --> RLS
```

---

### 2.2 End-to-End User & Data Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Accountant / Site Manager
    participant App as Frontend (Next.js UI)
    participant MW as Middleware & Zod Guard
    participant API as API Route Handler
    participant Acc as Double-Entry Accounting Engine
    participant DB as PostgreSQL (Supabase RLS)

    User->>App: 1. Login / Select Active Company
    App->>MW: Authenticate JWT Token Cookie
    MW->>App: Session Verified & Active Context Loaded

    alt Option A: Create Sales Invoice (Billed to Builder for Specific Site)
        User->>App: Select Builder (Customer), Select/Type Site Name, Items, Rate & Tax
        App->>MW: POST /api/sales (Payload)
        MW->>MW: Validate with Zod saleSchema & Check Rate Limit
        MW->>API: Route Handler
        API->>API: Compute Intra-State (CGST+SGST) vs Inter-State (IGST)
        API->>DB: Insert into 'sales' table & Deduct Inventory Stock
        API->>Acc: Post Sale to Double-Entry Ledger
        Acc->>DB: Insert 'ledger_entries' (Debit Customer / Credit Sales)
        API->>App: Return Created Invoice & PDF Download Link (With Builder & Site Header)
    else Option B: Record Day Book Entry (Rojmel Jama / Udhar & Site Expense)
        User->>App: Click 'Add Manual Entry (IN / OUT)'
        User->>App: Choose IN (Jama) or OUT (Udhar), Select Saved/Custom Site, Amount & Mode
        App->>MW: POST /api/reports/daybook
        MW->>MW: Validate with Zod expenseEntrySchema
        MW->>API: Route Handler
        API->>Acc: Post Journal Entry with Site Tag
        Acc->>DB: Insert 'ledger_entries' (Debit Expense/Credit Cash or Vice Versa)
        API->>App: Updated Day Book Ledger Array
    else Option C: Upload Purchase Invoice via AI
        User->>App: Upload Supplier PDF/Image
        App->>API: POST /api/ai/parse-sales (File Buffer)
        API->>API: Send Buffer to Google Gemini 1.5 Vision API
        API->>App: Auto-extracted JSON (Supplier GSTIN, Date, Items, Tax)
        User->>App: Review & Save Purchase
        API->>DB: Replenish Stock & Post Purchase Ledger
    end

    App-->>User: Visual Success Feedback & Real-time Graph Update
```

---

### 2.3 Application Capabilities Flowchart

```mermaid
flowchart TD
    AppHome["BillBharat Application Capabilities"]

    AppHome --> F1["🏢 Companies Module (/companies)"]
    AppHome --> F2["👥 Customers Master (/customers)"]
    AppHome --> F3["📦 Inventory & Stock (/inventory)"]
    AppHome --> F4["🧾 GST Sales & Invoices (/sales)"]
    AppHome --> F5["🛒 Purchases & Bills (/purchase)"]
    AppHome --> F6["🏗️ Projects & BOQ (/projects)"]
    AppHome --> F7["📖 Rojmel / Day Book (/reports/daybook)"]
    AppHome --> F8["🤖 AI Document Readers (/purchase/ai-upload, /sales/ai-upload)"]
    AppHome --> F9["📊 Reports & Edit Log (/reports)"]
    AppHome --> F10["⚡ High Performance Engine"]

    F1 --> F1_1["• Create/Switch Business Entities\n• Configure GSTIN, PAN, Bank Details\n• Custom Invoice Templates & Terms"]
    F2 --> F2_1["• Manage Client Contact & Address\n• Track Credit Limits & Total Outstanding\n• Filter Transactions by Client"]
    F3 --> F3_1["• Manage HSN Codes & GST Rates (5%-28%)\n• Track Real-time Stock Quantities\n• Low Stock Alerts & Purchase/Selling Prices"]
    F4 --> F4_1["• Bill Builder with Changing Project/Site\n• Auto CGST/SGST vs IGST calculation\n• PDF shows Bill To: Builder & Site Location"]
    F5 --> F5_1["• Record Supplier Purchases & Bills\n• Auto-replenish inventory stock\n• Supplier Passbook Statement (Jama & Udhar)"]
    F6 --> F6_1["• Track Civil/Construction Sites & Contracts\n• Site Passbook Statement (Jama & Udhar)\n• BOQ Progress Tracking & Auto-hiding empty BOQs"]
    F7 --> F7_1["• Live daily transaction register (Rojmel)\n• Manual IN (Jama) & OUT (Udhar) entries\n• Tag entries to Saved Sites or Custom Typed Site"]
    F8 --> F8_1["• Upload Supplier or Client PDF / Photo\n• Gemini 1.5 Vision AI extracts bill data\n• Master Product List CSV Upload / Manual Typing"]
    F9 --> F9_1["• GSTR-1 & GSTR-3B Tax slab reports\n• Export Sales & Purchases to Excel/CSV\n• Full Audit Log history of all edits/deletions"]
    F10 --> F10_1["• Parallel Frontend Data Fetching (Promise.all)\n• 20-Connection Warmed PostgreSQL Pooler\n• Instant 0ms Tab Navigation in Production"]
```

---

### 2.4 Rojmel / Accounting Day Book (Jama / Udhar) Workflow

```mermaid
flowchart LR
    A["User clicks 'Add Manual Entry (IN / OUT)'"] --> B{"Choose Entry Type"}
    
    B -- "IN (Jama / Money Received)" --> C["Enter Category (Customer Payment, Site Advance, Sales Income)"]
    B -- "OUT (Udhar / Money Spent)" --> D["Enter Category (Site Expense, Labor, Materials, Fuel, Rent)"]

    C --> E["Select Respective Site / Project (or type Custom Site Name)"]
    D --> E

    E --> F["Enter Amount (₹), Payment Mode (Cash/UPI/Bank) & Notes"]
    F --> G["Submit POST /api/reports/daybook"]
    G --> H["Zod Validation (expenseEntrySchema)"]
    
    H -- Success --> I{"Check Entry Type"}

    I -- IN (Jama) --> J["Debit: Cash/Bank Account\nCredit: Category [Site Tag]"]
    I -- OUT (Udhar) --> K["Debit: Category [Site Tag]\nCredit: Cash/Bank Account"]

    J --> L["Insert into 'ledger_entries' Table in Postgres"]
    K --> L
    L --> M["Live Update Day Book Table & Balances"]
```

---

### 2.5 GST Sales Invoicing Workflow

```mermaid
flowchart TD
    Start["User creates Sales Invoice"] --> SelectCust["Select Customer (Builder) & Project / Site"]
    SelectCust --> CheckState{"Compare Supplier State Code vs Customer State Code"}

    CheckState -- "Same State (Intra-State)" --> CGST_SGST["Calculate CGST (50%) + SGST (50%)"]
    CheckState -- "Different State (Inter-State)" --> IGST["Calculate IGST (100%)"]

    CGST_SGST --> SaveSale["POST /api/sales"]
    IGST --> SaveSale

    SaveSale --> DBInsert["Insert record into 'sales' table & Save Site Tag in Metadata"]

    DBInsert --> AffectStock{"Does Document Affect Stock? (Tax Invoice / Delivery Challan)"}
    AffectStock -- Yes --> DecStock["Deduct Quantity from 'inventory' table"]
    AffectStock -- No --> PostLedger

    DecStock --> PostLedger["Post Double-Entry Ledger Record with Site Tag"]
    PostLedger --> GenPDF["Generate GST Boxed Invoice PDF (Bill To: Builder | Site: Location)"]
    GenPDF --> Finish["Return Invoice & Download Link"]
```

---

### 2.6 Database Entity Relationship Diagram (12 Schemas)

```mermaid
erDiagram
    USERS ||--o{ COMPANIES : "owns"
    COMPANIES ||--o{ CUSTOMERS : "has"
    COMPANIES ||--o{ INVENTORY : "manages"
    COMPANIES ||--o{ PROJECTS : "executes"
    COMPANIES ||--o{ SALES : "issues"
    COMPANIES ||--o{ PURCHASES : "buys"
    COMPANIES ||--o{ PAYMENTS : "processes"
    COMPANIES ||--o{ LEDGER_ENTRIES : "records"
    COMPANIES ||--o{ JOURNAL_ENTRIES : "posts"
    COMPANIES ||--o{ PRODUCT_MAPPINGS : "maps"
    COMPANIES ||--o{ AUDIT_LOGS : "tracks"

    CUSTOMERS ||--o{ SALES : "receives"
    CUSTOMERS ||--o{ PROJECTS : "contracts"
    PROJECTS ||--o{ SALES : "bills"
```

---

## 3. Comprehensive Feature Directory & Technical Modules

### 🏢 3.1 Multi-Tenancy & Company Context
- **Multi-Company Management**: Manage multiple business entities (e.g., hardware store, electrical contracting firm, construction firm) under a single login.
- **`CompanyContext` Guard**: Instantly switches active company context across all UI routes and API calls via the `x-company-id` header.
- **Company Branding & Settings**: Set company-specific GSTIN, PAN, Bank Details, Logo, Invoice Terms, and word-by-word company title typography.

---

### 🧾 3.2 GST Invoicing & Document Engine (Builder + Site Billing)
- **Builder + Site Billing Solution**:
  - **Bill To**: Customer / Builder Corporate Name (e.g. *Shree Ram Builders*) & GSTIN.
  - **Project / Site**: Selected Project or Custom Typed Site Name.
  - **PDF Formatting**: Generates official GST-compliant PDF headers with Bill To, Delivery Site, Ship To, Itemized Taxes, and QR/Bank details.
- **Document Types**: Tax Invoice (stock affecting), Bill of Supply, Delivery Challan, Proforma Invoice, Quotation, Credit Note.
- **Automated Tax Logic**:
  - **Intra-State**: Same State Code $\rightarrow$ 50% CGST + 50% SGST.
  - **Inter-State**: Different State Code $\rightarrow$ 100% IGST.

---

### 🏗️ 3.3 Projects & Site Passbook Statement
- **Site Passbook Statement (Jama & Udhar)**:
  - **Invoice Billed**: Placed under **Udhar (Dr)** (Customer Debt / Receivable).
  - **Payment Received**: Placed under **Jama (Cr)** (Money Received in 1, 2, or 3 installments).
  - **Excludes Daybook**: Focuses strictly on customer billing and payment settlement.
  - **Running Customer Due**: Live running balance showing exact remaining customer debt.
- **Bill of Quantities (BOQ)**: Set scope items with rates and quantities; automatically hides BOQ section if 0 scope items exist.

---

### 🛒 3.4 Purchases & Supplier Passbook Statement
- **AI Purchase Reader (`/purchase/ai-upload`)**: Uses Google Gemini 1.5 Flash Vision to parse supplier invoice PDFs/photos in seconds, extracting Supplier Name, GSTIN, Bill Date, Line Items, Rates, and Taxes.
- **Supplier Passbook Statement (Jama & Udhar)**:
  - **Purchase Bill Received**: Placed under **Udhar (Dr)** (We owe supplier).
  - **Payment Paid to Supplier**: Placed under **Jama (Cr)** (Cash/UPI/Bank paid out).
  - **Running Supplier Payable**: Live running balance showing exact vendor payable liability.

---

### 📦 3.5 Inventory & Master Product List
- **Dual Pricing & Stock Alerts**: Track Purchase Price, Selling Price, HSN, and low-stock threshold warnings.
- **Master Product Catalogue**:
  - Add single master items.
  - **Bulk Typing / Copy-Paste**: Type or paste product master names (one item per line).
  - **Upload CSV / Excel File**: Import `.csv` or `.xlsx` files to populate master product names.
- **Auto-Product Mapping**: Automatically maps supplier item names (`realName`) on bills to internal master items (`systemName`) and saves them to `product_mappings`.

---

### 📖 3.6 Rojmel / Day Book & Double-Entry Ledger
- **Live Day Book (`/reports/daybook`)**: Chronological daily register displaying Date, Particulars, Voucher Type, Debit (Udhar / ઉધાર), and Credit (Jama / જમા).
- **Manual IN / OUT Entry Modal**: Record IN (Jama / Money Received) or OUT (Udhar / Money Spent) tagged to saved sites or custom typed site names.
- **Manual Journal Vouchers (F7)**: Record non-cash adjustments, depreciation, and year-end entries with strict double-entry balancing validation.
- **Audit Logs (Edit History)**: Tracks every update and deletion in `audit_logs` storing previous data, new data, user ID, and timestamp for CA compliance.

---

## 4. BillBharat vs. TallyPrime Comparison

| Feature Category | TallyPrime (Standard) | BillBharat (Your Software) | Advantage |
| :--- | :--- | :--- | :--- |
| **Accessibility** | Desktop-based. Requires "Tally on Cloud" (extra cost) for remote access. | **Native Cloud-First**. Accessible from any browser (Phone, Tablet, Laptop) via Vercel. | **BillBharat**: Real-time access from sites or on the go without setup. |
| **User Interface** | Keyboard-centric, legacy "Green-Screen" style. Steep learning curve. | **Modern Web UI**. Clean, intuitive dashboards with visual charts (Recharts). | **BillBharat**: No training required; feels like a modern app. |
| **Data Entry** | Manual entry for every ledger and stock item. | **AI-Powered Extraction**. Automatically reads purchase & sales bills via Gemini AI. | **BillBharat**: Saves 90% of time on procurement data entry. |
| **Procurement (Purchases)** | Requires manual matching of supplier names to internal items. | **Smart Mapping & Master CSV Import**. Learns vendor product names & maps to inventory. | **BillBharat**: Eliminates manual product name reconciliation. |
| **Inventory Management** | Traditional stock tracking. Prone to duplicate SKUs (e.g., "Steel" vs "Steel 10mm"). | **Similarity Matching**. Uses AI logic to detect and merge duplicate items. | **BillBharat**: Keeps your inventory catalog clean and professional. |
| **Project / BOQ Tracking** | Basic cost centers; requires complex setup to track project progress. | **Native Site Passbook (Jama/Udhar)** & BOQ progress tracking. | **BillBharat**: Built specifically for builders/contractors to see project health. |
| **Multi-Tenancy** | Requires switching "Company" files; data is siloed in local folders. | **Switchable Company Context**. Managed from a single login with instant switching. | **BillBharat**: Manage multiple businesses/firms seamlessly. |
| **Collaboration** | Single-user (Silver) or LAN-based Multi-user (Gold). | **Infinite Users**. Multiple staff can work on sales/purchases simultaneously. | **BillBharat**: Better for growing teams with site supervisors. |
| **Deployment & Cost** | High upfront license fee + annual Renewal (TSS). | **Scale-as-you-go**. Hosted on Supabase/Vercel with minimal infra costs. | **BillBharat**: Zero upfront licensing fees. |

---

## 5. Technical Database Schema & Deployment

### 5.1 Supabase PostgreSQL Database Setup (12 Tables)

```sql
-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. COMPANIES
CREATE TABLE IF NOT EXISTS companies (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "userId"           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  gstin              TEXT,
  pan                TEXT,
  address            TEXT,
  phone              TEXT,
  email              TEXT,
  "bankName"         TEXT,
  "bankAccountNo"    TEXT,
  "bankIfsc"         TEXT,
  "bankBranch"       TEXT,
  "stateCode"        TEXT DEFAULT '24',
  "invoiceTerms"     TEXT,
  "invoiceTemplate"  TEXT,
  "logoUrl"          TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId"  TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  "gstNumber"  TEXT,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  state        TEXT,
  "stateCode"  TEXT,
  "creditLimit" NUMERIC DEFAULT 0,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. INVENTORY
CREATE TABLE IF NOT EXISTS inventory (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId"         TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  sku                 TEXT,
  category            TEXT,
  "hsnCode"           TEXT,
  unit                TEXT DEFAULT 'PCS',
  "purchasePrice"     NUMERIC DEFAULT 0,
  "sellingPrice"      NUMERIC DEFAULT 0,
  "gstRate"           NUMERIC DEFAULT 18,
  quantity            NUMERIC DEFAULT 0,
  "lowStockThreshold" NUMERIC DEFAULT 0,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId"     TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "customerId"    TEXT REFERENCES customers(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  code            TEXT,
  status          TEXT DEFAULT 'Active',
  "contractValue" NUMERIC DEFAULT 0,
  "startDate"     TIMESTAMPTZ,
  "endDate"       TIMESTAMPTZ,
  description     TEXT,
  notes           TEXT,
  "boqItems"      JSONB DEFAULT '[]',
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. SALES
CREATE TABLE IF NOT EXISTS sales (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId"     TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "customerId"    TEXT REFERENCES customers(id) ON DELETE SET NULL,
  "projectId"     TEXT REFERENCES projects(id) ON DELETE SET NULL,
  "invoiceNumber" TEXT NOT NULL,
  "invoiceDate"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "dueDate"       TIMESTAMPTZ,
  "documentType"  TEXT DEFAULT 'Tax Invoice',
  items           JSONB DEFAULT '[]',
  subtotal        NUMERIC DEFAULT 0,
  cgst            NUMERIC DEFAULT 0,
  sgst            NUMERIC DEFAULT 0,
  igst            NUMERIC DEFAULT 0,
  discount        NUMERIC DEFAULT 0,
  total           NUMERIC DEFAULT 0,
  "amountPaid"    NUMERIC DEFAULT 0,
  status          TEXT DEFAULT 'Unpaid',
  notes           TEXT,
  "pdfUrl"        TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. PURCHASES
CREATE TABLE IF NOT EXISTS purchases (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId"     TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "supplierName"  TEXT NOT NULL,
  "supplierGst"   TEXT,
  "billNumber"    TEXT,
  "billDate"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  items           JSONB DEFAULT '[]',
  subtotal        NUMERIC DEFAULT 0,
  cgst            NUMERIC DEFAULT 0,
  sgst            NUMERIC DEFAULT 0,
  igst            NUMERIC DEFAULT 0,
  total           NUMERIC DEFAULT 0,
  "amountPaid"    NUMERIC DEFAULT 0,
  status          TEXT DEFAULT 'Unpaid',
  notes           TEXT,
  "pdfUrl"        TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. PRODUCT MAPPINGS
CREATE TABLE IF NOT EXISTS product_mappings (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId"   TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "realName"    TEXT NOT NULL,
  "systemName"  TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  "refId"     TEXT NOT NULL,
  amount      NUMERIC NOT NULL DEFAULT 0,
  method      TEXT DEFAULT 'Cash',
  date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes       TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. LEDGER ENTRIES
CREATE TABLE IF NOT EXISTS ledger_entries (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "projectId" TEXT REFERENCES projects(id) ON DELETE SET NULL,
  date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type        TEXT NOT NULL,
  "refId"     TEXT,
  "accountName" TEXT NOT NULL,
  debit       NUMERIC DEFAULT 0,
  credit      NUMERIC DEFAULT 0,
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. JOURNAL ENTRIES
CREATE TABLE IF NOT EXISTS journal_entries (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "voucherNo" TEXT NOT NULL,
  date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT,
  entries     JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "companyId" TEXT,
  "userId"    TEXT,
  table_name  TEXT NOT NULL,
  "recordId"  TEXT NOT NULL,
  action      TEXT NOT NULL,
  "oldData"   TEXT,
  "newData"   TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 5.2 Summary of Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 14 (App Router) |
| **Runtime & Language** | JavaScript (ES6+ / Node.js 20) |
| **UI Styling** | React 18, Tailwind CSS, Lucide React Icons |
| **Database** | PostgreSQL / Supabase Postgres (20-Connection Warmed Pooler) |
| **Security & Auth** | `jose` (JWT), `bcryptjs`, Cookie Sessions (`bb_session`) |
| **Schema Validation** | Zod Payload Validation |
| **PDF Generation** | `jspdf`, `jspdf-autotable` |
| **Charts & Analytics** | `recharts` |
| **AI Vision Engine** | `@google/generative-ai` (Gemini 1.5 Flash) |
| **Excel / CSV Import & Export** | `xlsx` |

---
*BillBharat Master Architecture Specification — Consolidated May 2026*
