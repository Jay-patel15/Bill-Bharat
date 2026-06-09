# BillBharat: Comprehensive Technical Implementation Record

This document is the definitive guide to the architectural evolution and feature set of BillBharat. It documents the transition from a Google Sheets-based backend to a high-performance Supabase infrastructure, the UI overhaul of the procurement system, and a detailed breakdown of every application feature.

---

## 1. Project Workflow & Evolution
The project followed a three-phase evolution to reach its current stable state:

1.  **Phase 1: Google Sheets Foundation**: Initially used Google Sheets as a database. While transparent, it suffered from API rate limits and 5-10 second data latencies.
2.  **Phase 2: Convex Experiment**: Explored Convex for real-time synchronization. Decision made to move to a relational SQL structure to better handle complex accounting relationships.
3.  **Phase 3: Supabase Finalization**: Migrated to Supabase (PostgreSQL). Provided the best balance of speed, strict data typing, and seamless Vercel deployment.

---

## 2. Feature Directory: What each part does

### 🔐 Authentication & Multi-Tenancy
- **JWT Authentication**: Secure login and signup using JSON Web Tokens.
- **Multi-Company Support**: Users can create and manage multiple companies. Data is isolated by `companyId`, allowing a single user to manage several business entities (e.g., a hardware shop and a separate construction firm) from one account.
- **Company Context**: The `CompanyContext` provider ensures the entire UI updates instantly when switching between active companies.

### 📊 Main Dashboard
- **Financial Pulse**: Real-time summary of Total Sales, Total Purchases, and Net Profit.
- **Visual Analytics**: Interactive charts (Recharts) showing monthly revenue trends and expense breakdowns.
- **Quick Actions**: Shortcuts to create new invoices or record purchase bills.

### 👥 Customers & Builders Dashboard
- **Builder Tiles**: Displays each customer as a "Tile" with high-level summaries of Billed vs. Received amounts.
- **Personal Ledger**: Detailed transaction history for each builder, tracking every invoice and payment.
- **Outstanding Tracking**: Automatically calculates and highlights pending balances for easier follow-ups.

### 📦 Inventory & Stock Management
- **SKU Tracking**: Manage products with unique SKUs and HSN codes for GST compliance.
- **Dual-Pricing**: Tracks both Purchase Price and Selling Price to calculate margins automatically.
- **Stock Alerts**: Monitors quantities and provides low-stock indicators.
- **Similarity Matching**: Intelligent logic to detect duplicate inventory items and merge them to prevent catalog clutter.

### 🧾 Sales & Invoicing
- **Smart Invoice Creator**: Dynamic item entry with automatic GST (CGST/SGST/IGST) calculation.
- **PDF Generation**: One-click generation of professional, GST-ready PDF invoices using `jsPDF`.
- **Payment Status**: Track invoices as "Unpaid," "Partially Paid," or "Paid."
- **Ledger Integration**: Every sale automatically updates the customer's outstanding balance.

### 🏗️ Projects & BOQ Management
- **Bill of Quantities (BOQ)**: Manage large-scale contracts with itemized BOQ lists.
- **Progress Tracking**: Compare actual sales against project contract values to monitor completion percentages.

### 🤖 AI-Powered Procurement (AI Upload)
- **Automatic Extraction**: Users can upload images or PDFs of purchase bills.
- **Extracted Text Preservation**: The system preserves the exact text found on the bill (`realName`) even if you map it to a different product in your inventory.
- **Smart Product Mapping**: 
    - If the system recognizes an extracted name from previous bills, it auto-suggests your preferred "System Name."
    - If it's a new product, you can link it to an existing inventory item or keep it as is.
    - **Approval Workflow**: Upon approval, the system automatically creates a permanent mapping between the supplier's name for the product and your system name. It also automatically creates the product in your **Inventory (Settings List)** if it doesn't already exist.
- **One-Click Saving**: Extracted data is mapped to the database instantly, eliminating manual data entry.

### 🚛 Purchase & Supplier Dashboard
- **Supplier Grid**: Automatically groups all purchase bills by vendor.
- **Liability Management**: Tracks exactly how much is owed to which supplier.
- **Quick Payments**: Dedicated interface for recording payments to vendors, supporting partial payments and total bill closure.

### 🏛️ Professional Accounting (Tally-Style)
- **Double-Entry Ledger Engine**: Behind the scenes, the system now implements a full double-entry accounting engine. Every **Sale** or **Invoice** automatically generates corresponding **Debit** and **Credit** rows in the `ledger_entries` table.
- **Manual Journal Vouchers (F7)**:
    - **What it is**: A professional accounting tool to record non-cash transactions or adjustments (e.g., Depreciation, Year-end adjustments).
    - **How to use**: Go to **Manual Journals** in the sidebar. Click **New Journal**. Add at least two ledger rows (one Debit, one Credit). The system ensures the entry is **balanced** before saving.
- **Audit Trails (Edit History)**:
    - **What it is**: A mandatory feature for CA compliance that tracks every modification to the data.
    - **How it works**: The core database adapter (`lib/db.js`) now hooks into every `UPDATE` and `DELETE` operation. It saves the **old version**, the **new version**, and the **user** who made the change in the `audit_logs` table.
    - **How to access**: View the **Audit Log** report from the sidebar to see the chronological history of changes.
- **Statutory Compliance (GSTR-1 JSON)**:
    - **What it is**: A one-click tool to export data for the GST Portal.
    - **How to use**: In the **GST Report** page, click **Export GSTR-1 JSON**. It generates a government-compatible JSON file that can be directly uploaded to the GST portal for filing.

### 🛒 Checkout & Payments Flow
- **Manual Payments**: Since this is a B2B invoicing application, it lacks automated online storefront checkout flows (like Stripe/Razorpay) or auto-logout sessions. Payments are entered and tracked manually (supporting Cash, UPI, NEFT, RTGS, Cheque, Bank Transfer).
- **Automated Stock Deduction ("Inventory Checkout")**: Saving a stock-affecting document (e.g., Tax Invoice or Delivery Challan) automatically decrements the quantities of the sold items in the inventory.
- **Auto Status & Outstanding Calculations**: The system dynamically updates invoice status (Unpaid, Partially Paid, Paid) and adjusts the customer's outstanding balance as payments are recorded.

---

## 3. Supabase Integration Details

### The "Drop-in Adapter" Architecture
To migrate without breaking the existing codebase, we implemented a **Database Abstraction Layer**.
- **File Location**: `lib/db.js` (Primary Supabase adapter).
- **Functionality**: This file exports standard CRUD functions (`listAll`, `insert`, `update`, `findOne`) that match the original API expected by the app.
- **Audit Integration**: The `update` and `remove` functions are now globally instrumented to record **Audit Logs** for every transaction.

### Database Setup (SQL Schema)
The following SQL creates the relational backbone of the app. **Note: All `id` fields are `text` for client-side UUID flexibility.**

```sql
-- Users, Companies, Customers, Inventory, Sales, Purchases, Projects, Payments, etc...
-- (Refer to existing SQL above)

-- NEW: Audit Logs (Edit Log for CA compliance)
CREATE TABLE audit_logs ( id text primary key, "companyId" text, "userId" text, "table" text, "recordId" text, action text, "oldData" text, "newData" text, "createdAt" text );

-- NEW: Ledger Entries (Atomic Double-Entry rows)
CREATE TABLE ledger_entries ( id text primary key, "companyId" text, date text, type text, "refId" text, "ledgerName" text, debit numeric DEFAULT 0, credit numeric DEFAULT 0, description text, "createdAt" text );

-- NEW: Journal Entries (Container for Manual Journals)
CREATE TABLE journal_entries ( id text primary key, "companyId" text, date text, description text, entries jsonb, "createdAt" text, "updatedAt" text );
```

---

## 4. Environment & Deployment (Vercel)

### Critical Variables:
- `NEXT_PUBLIC_SUPABASE_URL`: The project URL (no `/rest/v1/`).
- `SUPABASE_SERVICE_ROLE_KEY`: Secret key for secure DB access.
- `STORAGE_BACKEND=drive`: Keeps PDF files on Google Drive.

### Troubleshooting:
- **.env.local Overrides**: Ensure `.env.local` does not contain empty versions of keys found in `.env`.
- **JSON Errors**: Restart the dev server (`npm run dev`) after any `.env` modification.

---
*Created by Antigravity AI - May 2026*
