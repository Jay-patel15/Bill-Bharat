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

### 🚛 Purchase & Supplier Dashboard (New)
- **Supplier Grid**: Automatically groups all purchase bills by vendor.
- **Liability Management**: Tracks exactly how much is owed to which supplier.
- **Quick Payments**: Dedicated interface for recording payments to vendors, supporting partial payments and total bill closure.

---

## 3. Supabase Integration Details

### The "Drop-in Adapter" Architecture
To migrate without breaking the existing codebase, we implemented a **Database Abstraction Layer**.
- **File Location**: `lib/google/sheets.js` (Acting as the Supabase adapter).
- **Functionality**: This file exports standard CRUD functions (`listAll`, `insert`, `update`, `findOne`) that match the original API expected by the app.
- **Why?**: This allowed a 100% backend swap with 0% changes to the application's business logic.

### Database Setup (SQL Schema)
The following SQL creates the relational backbone of the app. **Note: All `id` fields are `text` for client-side UUID flexibility.**

```sql
-- Users & Auth
CREATE TABLE users ( id text primary key, email text, "passwordHash" text, name text, "googleId" text, role text, "resetToken" text, "resetTokenExpiresAt" text, "createdAt" text, "updatedAt" text );

-- Core Business
CREATE TABLE companies ( id text primary key, "userId" text, name text, "logoUrl" text, address text, city text, state text, "stateCode" text, pincode text, "gstNumber" text, "panNumber" text, "bankAccountNo" text, "bankIfsc" text, "bankName" text, "termsAndConditions" text, phone text, email text, "createdAt" text, "updatedAt" text, "bankBranch" text );

-- CRM & Inventory
CREATE TABLE customers ( id text primary key, "companyId" text, name text, phone text, email text, address text, state text, "stateCode" text, "gstNumber" text, "creditLimit" numeric, outstanding numeric, "createdAt" text, "updatedAt" text );
CREATE TABLE inventory ( id text primary key, "companyId" text, name text, sku text, category text, "purchasePrice" numeric, "sellingPrice" numeric, "gstRate" numeric, quantity numeric, "lowStockThreshold" numeric, unit text, "hsnCode" text, "createdAt" text, "updatedAt" text );

-- Transactions
CREATE TABLE sales ( id text primary key, "companyId" text, "customerId" text, "projectId" text, "documentType" text, "invoiceNumber" text, "invoiceDate" text, "dueDate" text, items jsonb, subtotal numeric, discount numeric, cgst numeric, sgst numeric, igst numeric, total numeric, "amountPaid" numeric, status text, notes text, "pdfUrl" text, "createdAt" text, "updatedAt" text );
CREATE TABLE purchases ( id text primary key, "companyId" text, "supplierName" text, "supplierGst" text, "billNumber" text, "billDate" text, items jsonb, subtotal numeric, cgst numeric, sgst numeric, igst numeric, total numeric, "amountPaid" numeric, status text, notes text, "pdfUrl" text, "createdAt" text, "updatedAt" text, "customerId" text );

-- Projects, Payments & Mappings
CREATE TABLE projects ( id text primary key, "companyId" text, "customerId" text, name text, code text, description text, "boqItems" jsonb, "contractValue" numeric, "startDate" text, "endDate" text, status text, notes text, "createdAt" text, "updatedAt" text );
CREATE TABLE payments ( id text primary key, "companyId" text, type text, "refId" text, amount numeric, method text, date text, notes text, "createdAt" text, "updatedAt" text );
CREATE TABLE product_mappings ( id text primary key, "companyId" text, "realName" text, "systemName" text, "createdAt" text, "updatedAt" text );
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
