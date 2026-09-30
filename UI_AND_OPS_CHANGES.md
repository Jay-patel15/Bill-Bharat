# BillBharat — UI & Operations Changes Log

This document tracks all functional, UI, database, navigation, and operational fixes applied to the BillBharat codebase.

---

## Recent Updates & Fixes Log

### 1. Navigation & Sidebar Re-organization
- **Sub-Menu Navigation Tabs (`components/reports-nav.jsx`)**: Created a dedicated, reusable horizontal tabbed navigation bar for all Reports sub-pages:
  - 📊 Reports Hub (`/reports`)
  - 📈 Sales Report (`/reports/sales`)
  - 🧾 GST Summary (`/reports/gst`)
  - 💰 Finance Overview (`/reports/finance`)
  - ⏳ Outstanding Dues (`/reports/outstanding`)
  - 📖 Day Book - Rojmel (`/reports/daybook`)
  - 📜 Audit Log (`/reports/audit`)
- **Bottom Disabled Nav Items**:
  - Moved **Projects (BOQ)** (`/projects`) and **Manual Journals** (`/journals`) to the very bottom of the sidebar (`lib/navigation.js` and `components/sidebar.jsx`).
  - Added visual disabled styling (muted text, strike-through text, and a "Disabled" badge) so users cannot navigate to incomplete/disabled modules.

### 2. Dark Mode Toggle
- **Theme Toggle Button (`components/topbar.jsx`)**: Added a Sun / Moon toggle button to the top navigation header bar.
- **Theme Persistence**: Persists user selection in `localStorage` under `bb_theme` (`dark` vs `light`) and dynamically toggles the `.dark` CSS class on `document.documentElement`.
- **CSS Styling (`app/globals.css`)**: Fully aligned with Tailwind CSS dark mode design system (dark cards, dark background, readable contrast).

### 3. Payment Recording API Fix (`/api/sales/[id]/payments`)
- **Fixed 404 Not Found on Partial Payments**: Implemented missing `POST` and `GET` API route handlers in `app/api/sales/[id]/payments/route.js`.
- **Automatic Status Updates**: Recording partial or full customer payments now:
  - Inserts payment receipt records.
  - Recalculates and decrements customer outstanding balance.
  - Automatically updates invoice status to `Partially Paid` or `Paid`.

### 4. Unit Column & Deletion/Backspace Fix
- **Unit Deletion Fix**: Resolved the bug where deleting a unit letter (e.g. deleting 'P' from 'PCS') reverted back to 'PCS'. Changed `value={it.unit || "PCS"}` to `value={it.unit ?? ""}` across Create Invoice, Purchases, and Inventory forms.
- **GST Standard Unit Suggestions**: Added `<datalist>` dropdown with standard Indian GST unit options (`PCS`, `NOS`, `KG`, `L`, `MTR`, `BOX`, `SET`, `SQFT`, `SQM`, `GMS`, `TON`, `BAG`, `BTL`, `PAC`, `DOZ`, `RFT`, `JOB`, `HRS`, `CAN`, `KLR`) while permitting custom unit entry.
- **UI & PDF Display**: Added Unit column to Invoice tables, Purchase tables, Sale detail page, and PDF rendering engine (`lib/pdf.js`).

### 5. Local SQLite Database Migration & Auth Fixes
- **Offline Storage**: Replaced PostgreSQL (`pg`) with 100% offline WebAssembly SQLite (`node-sqlite3-wasm`) writing to `./.data/billbharat.db`.
- **Foreign Key Auto-Seeding (`lib/auth.js`)**: Resolved `SQLite3Error: FOREIGN KEY constraint failed` under `DEV_BYPASS_AUTH=1` by ensuring the default `dev-user-id` is automatically seeded into the `users` table upon startup.

### 6. Day Book Receipt & Payment Double-Entry Accounting (`lib/accounting.js`)
- **Payment Receipt Voucher Integration**: Created `recordPaymentAccounting()` helper so every full or partial customer payment (e.g. ₹385 Cash, ₹500 UPI) automatically posts `RECEIPT` double-entry records to `ledger_entries`:
  - **Debit**: Cash or Bank Account (Money Received)
  - **Credit**: Customer Ledger (Decrements Debtors balance / Jama)
- **Auto-Sync & Cleanup**: Updated Day Book API (`/api/reports/daybook` and `/api/reports/daybook/sync`) to automatically sync all existing and new partial payments into the Day Book (Rojmel), and clean up ledger entries if a payment is deleted.

---

## Answers to Repository Questions

### Q1: Why is there a folder named `electron` and `doc.md` in this branch (`main`)?
- **`electron/`**: Contains the Electron wrapper main process file (`electron/main.js`) used when building the desktop `.exe` installer.
- **`doc.md`**: Contains the complete internal architecture, packaging instructions, and database reference manual.
- *Note*: During the earlier SQLite database migration, code updates were pushed/merged so local web dev and desktop packaging run off the same unified codebase. If you want `main` to be 100% pure web without Electron packaging assets, `electron/` can be cleanly removed from `main` anytime while keeping it safely in `exe`.

### Q2: Have you merged both branches (`main` and `exe`)?
- **Current Branch Status**: You are currently working on the **`main`** branch.
- **Branch Relationship**: The `exe` branch (`origin/exe`) was created as a snapshot for packaging the `.exe` desktop releases. `main` shares the same underlying code structure so features work identically in both web and desktop modes. No forced overwrites or destructive merges were performed against your `exe` branch.
