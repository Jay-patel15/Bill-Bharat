# BillBharat — Implementation & Operations Guide

Single source of truth: what's in the app, how to run it locally, how to deploy it to Vercel, and where to look when something breaks.

---

## Table of contents

1. [What the app is](#1-what-the-app-is)
2. [Tech stack](#2-tech-stack)
3. [Two-minute local run (no Google needed)](#3-two-minute-local-run-no-google-needed)
4. [Full local setup with Google Sheets + Drive](#4-full-local-setup-with-google-sheets--drive)
5. [Environment variables — full reference](#5-environment-variables--full-reference)
6. [Project structure](#6-project-structure)
7. [Document types](#7-document-types)
8. [Projects (BOQ-driven billing)](#8-projects-boq-driven-billing)
9. [AI Purchase Reader](#9-ai-purchase-reader)
10. [PDF generator](#10-pdf-generator)
11. [GST engine](#11-gst-engine)
12. [Storage backends](#12-storage-backends)
13. [API endpoints](#13-api-endpoints)
14. [Client `api()` helper](#14-client-api-helper)
15. [Architecture: where does what run](#15-architecture-where-does-what-run)
16. [End-to-end: Vercel + Sheets + Drive (recipe)](#16-end-to-end-vercel--sheets--drive-recipe)
17. [Deploying to Vercel — step by step](#17-deploying-to-vercel--step-by-step)
18. [Vercel free vs Pro](#18-vercel-free-vs-pro)
19. [Troubleshooting](#19-troubleshooting)
20. [Build log — everything done so far](#20-build-log--everything-done-so-far)
21. [Roadmap](#21-roadmap)
22. [Useful commands](#22-useful-commands)

---

## 1. What the app is

A GST-compliant invoicing, inventory, project-billing and finance platform for Indian businesses. Built as a single Next.js 14 (App Router) project that deploys to Vercel.

- **Auth**: email/password + Google OAuth (optional) + forgot/reset, JWT cookies
- **Multi-company**: each user can run multiple businesses; switch via the top-bar
- **Customers**: parties with GSTIN, credit limit, live outstanding balance, per-customer bill history
- **Inventory**: HSN, GST slab, stock levels, low-stock alerts
- **Projects (BOQ)**: per-customer projects with a Bill-of-Quantities; track Contract → Billed → Collected → Pending → Remaining with progress bars; bill milestone invoices off the BOQ
- **Sales**: 5 document types — Tax Invoice, Proforma Invoice (PI), Purchase Order (PO), Delivery Challan (DC), Quotation (QT); each can be linked to a project
- **Purchases**: supplier bills with auto-inventory increase
- **AI Purchase Reader**: side-by-side PDF preview + editable extracted data (Gemini 1.5 Flash)
- **Reports**: dashboard, sales, GST input/output, finance overview, Excel export
- **Storage**: Google Sheets (DB) + Google Drive (files), with **JSON file fallback for local dev**

---

## 2. Tech stack

| Concern        | Choice                                                                |
|----------------|-----------------------------------------------------------------------|
| Framework      | Next.js 14 (App Router, React 18)                                     |
| Styling        | Tailwind CSS + shadcn-style CSS variables (light/dark)                |
| UI primitives  | Custom (`/components/ui/*`) — Button, Input, Card, Table, Dialog, …   |
| Auth           | `jose` JWT in HTTP-only cookies; bcryptjs for password hashing        |
| DB (prod)      | Google Sheets via `googleapis` service account                        |
| DB (local)     | JSON files in `.data/` (auto-detected or `DATA_BACKEND=json`)         |
| Files (prod)   | Google Drive folders                                                  |
| Files (local)  | `public/uploads/` (auto-detected or `STORAGE_BACKEND=local`)          |
| GST engine     | Pure JS in `lib/gst.js` (slabs, intra/interstate, line + invoice)     |
| PDF            | `jspdf` + `jspdf-autotable` (page-break aware)                        |
| AI             | `@google/generative-ai` (gemini-1.5-flash) for PDF→JSON extraction    |
| Charts         | `recharts`                                                            |
| Excel export   | `xlsx`                                                                |

Node ≥ 18.17 (declared in `package.json`). Tested on 18.x and 20.x.

---

## 3. Two-minute local run (no Google needed)

This is the fastest path: JSON files for the database and `public/uploads/` for files. Zero Google setup. Works fully end-to-end except for the AI Purchase Reader (which always needs a Gemini key).

```bash
# 1. Install
npm install

# 2. Create the env file
cp .env.example .env.local
```

Open **`.env.local`** and put exactly this in (everything else can stay blank):

```env
JWT_SECRET=any-long-random-string-please
DATA_BACKEND=json
STORAGE_BACKEND=local
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional but needed only if you want to test the AI Purchase Reader:
GEMINI_API_KEY=
```

Run it:

```bash
npm run dev
```

Open http://localhost:3000.

1. Click **Sign up**, create a user (writes to `.data/users.json`)
2. You'll be sent to **Companies → Create** — fill the GSTIN/PAN/bank/T&C
3. Add a customer, add a few inventory items
4. Create a project (Projects → New) with a BOQ
5. Create your first invoice — **Bill from BOQ** to import scope items, then download the PDF

To **preview the UI without signing up at all** (e.g. for screenshots), set `DEV_BYPASS_AUTH=1` — middleware lets every request through and `getCurrentUser()` returns a dummy user.

To **wipe everything** and start over locally:

```bash
# Bash / Git Bash
rm -rf .data public/uploads

# PowerShell
Remove-Item -Recurse -Force .data, public/uploads
```

---

## 4. Full local setup with Google Sheets + Drive

Use this when you want to mirror production exactly, or share a database between teammates.

### 4.1 Create a Google Cloud project (one-time)

1. Open https://console.cloud.google.com → create a new project (any name)
2. Side menu → **APIs & Services → Library** → enable both:
   - **Google Sheets API**
   - **Google Drive API**
3. Side menu → **APIs & Services → Credentials** → **Create credentials → Service account**
   - Name it (e.g. `billbharat-server`), no roles needed at the project level
   - Open the service account → **Keys** → **Add key → Create new key → JSON** → download the file
4. Note the service account's email (looks like `billbharat-server@...iam.gserviceaccount.com`)

### 4.2 Create the spreadsheet (the database)

1. https://sheets.google.com → create a blank spreadsheet (any name)
2. **Share** it with the service-account email as **Editor**
3. Copy its **ID** from the URL: `https://docs.google.com/spreadsheets/d/`**`<ID>`**`/edit`
4. Don't add any tabs manually — the app creates `Users`, `Companies`, `Customers`, `Inventory`, `Sales`, `Purchases`, `Payments`, `Projects` automatically with correct headers on first request

### 4.3 Create the Drive folder (file storage)

1. https://drive.google.com → **New → Folder** (e.g. `BillBharat Files`)
2. Right-click → **Share** with the service-account email as **Editor**
3. Copy the folder's ID from its URL: `https://drive.google.com/drive/folders/`**`<ID>`**

### 4.4 Get a Gemini API key (only for the AI feature)

1. https://ai.google.dev → **Get API key** (it's free with generous limits)

### 4.5 Configure `.env.local`

```env
JWT_SECRET=any-long-random-string

# Paste the entire service-account JSON on a single line, OR base64 it (easier):
GOOGLE_CREDENTIALS_BASE64=<base64 of the file>
# Encode on Linux/macOS:  base64 -w0 service-account.json
# Encode on Windows PS:   [Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))

GOOGLE_SHEETS_SPREADSHEET_ID=<id from step 4.2>
GOOGLE_DRIVE_FOLDER_ID=<id from step 4.3>
GEMINI_API_KEY=<from step 4.4>

NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional Google login (skip unless you actually want it):
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

Run `npm run dev`. The first request to a Sheets-backed endpoint creates all the tabs (~3–5 s). Refresh and you're in.

---

## 5. Environment variables — full reference

| Var                              | Required when            | Purpose                                                       |
|----------------------------------|--------------------------|---------------------------------------------------------------|
| `JWT_SECRET`                     | always                   | HMAC key for session cookies                                  |
| `SESSION_COOKIE_NAME`            | optional                 | Cookie name (default `bb_session`)                            |
| `GOOGLE_CREDENTIALS_JSON`        | Sheets/Drive backend     | Service account JSON (single line)                            |
| `GOOGLE_CREDENTIALS_BASE64`      | Sheets/Drive backend     | Same JSON but base64-encoded (preferred on Vercel)            |
| `GOOGLE_SHEETS_SPREADSHEET_ID`   | Sheets backend           | Spreadsheet that acts as the database                         |
| `GOOGLE_DRIVE_FOLDER_ID`         | Drive backend            | Drive folder for uploads                                      |
| `GEMINI_API_KEY`                 | AI Purchase Reader       | Gemini API key                                                |
| `NEXT_PUBLIC_APP_URL`            | always                   | Public origin (used for absolute links + redirects)           |
| `GOOGLE_OAUTH_CLIENT_ID`         | Google login             | OAuth client id                                               |
| `GOOGLE_OAUTH_CLIENT_SECRET`     | Google login             | OAuth client secret                                           |
| `GOOGLE_OAUTH_REDIRECT_URI`      | Google login             | Must match Google Cloud config exactly                        |
| `DEV_BYPASS_AUTH`                | local UI preview only    | `1` to skip auth and inject a dummy user                      |
| `DATA_BACKEND`                   | optional                 | `json` \| `google`. Auto-detects when unset                   |
| `STORAGE_BACKEND`                | optional                 | `local` \| `drive`. Auto-detects when unset                   |
| `JSON_DATA_DIR`                  | optional                 | Override the JSON store directory (default `./.data`)         |

**Auto-detection rule**: if neither `GOOGLE_CREDENTIALS_JSON` nor `GOOGLE_CREDENTIALS_BASE64` is set, **JSON + local** mode is used. Setting `DATA_BACKEND` / `STORAGE_BACKEND` always wins.

---

## 6. Project structure

```
/app
  layout.jsx                    Root layout (Inter font, globals.css)
  page.jsx                      Redirects to /dashboard or /login
  globals.css                   Tailwind + shadcn HSL CSS variables
  (auth)/
    layout.jsx                  Split-screen marketing layout
    login/page.jsx
    signup/page.jsx
    forgot-password/page.jsx
    reset-password/page.jsx
  (app)/
    layout.jsx                  Server-side: loads user + companies, wraps in providers
    dashboard/page.jsx          KPIs, charts, project progress, low-stock, recent
    companies/
      page.jsx, create/page.jsx, [id]/page.jsx
    customers/
      page.jsx                  List + add/edit dialog
      [id]/page.jsx             Detail + bills timeline + inline edit
    inventory/
      page.jsx                  List + add/edit dialog
    projects/
      page.jsx                  Project cards with progress bars + filters
      create/page.jsx           BOQ-driven create form (auto contract value)
      [id]/page.jsx             Project detail + BOQ table + linked invoices
    sales/
      page.jsx                  Documents list (filter by type)
      create-invoice/page.jsx   Editable number, doc-type pills, project picker, "Bill from BOQ"
      [id]/page.jsx             Document detail + payment update + WhatsApp share
    purchase/
      page.jsx, create/page.jsx
      ai-upload/page.jsx        Side-by-side PDF preview + AI extraction review
    reports/
      page.jsx, sales/page.jsx, gst/page.jsx, finance/page.jsx
  api/
    health/route.js
    auth/{signup,login,logout,me,forgot,reset}/route.js
    auth/google/route.js, auth/google/callback/route.js
    companies/route.js, companies/[id]/route.js
    customers/route.js, customers/[id]/route.js
    inventory/route.js, inventory/[id]/route.js
    projects/route.js, projects/[id]/route.js, projects/[id]/summary/route.js
    sales/route.js, sales/[id]/route.js, sales/[id]/pdf/route.js
    purchases/route.js, purchases/[id]/route.js
    ai/parse-pdf/route.js
    upload/route.js
    reports/dashboard/route.js, reports/gst/route.js, reports/export/route.js

/components
  app-shell.jsx                 Sidebar + topbar wrapper (client)
  sidebar.jsx                   Active link = longest matching href
  topbar.jsx                    Company switcher dropdown
  company-context.jsx           CompanyProvider + api() helper (auto x-company-id)
  company-form.jsx, purchase-form.jsx
  empty-state.jsx               EmptyState + NoCompanySelected
  boq-editor.jsx                Inline BOQ row editor + boqSubtotal helper
  progress-bar.jsx              Layered Billed/Collected progress bar
  ui/
    button.jsx, input.jsx, card.jsx, badge.jsx, table.jsx, dialog.jsx, toast.jsx

/lib
  api.js                        ok/fail/withUser/readBody helpers
  auth.js                       JWT sign/verify, cookies, getCurrentUser/requireUser
  db.js                         assertCompanyAccess, getCompanyIdFromRequest
  utils.js                      cn, formatINR, formatDate, STATES,
                                nextInvoiceNumber, DOCUMENT_TYPES, getDocumentType
  gst.js                        slabs, isInterstate, computeLine, computeInvoice,
                                gstStateFromGstin, formatINR, numberToWords
  pdf.js                        generateInvoicePdf — multi-page, dynamic title
  ai.js                         parsePurchasePdf — Gemini 1.5 Flash
  google/
    auth.js                     Service-account credentials loader
    sheets.js                   SCHEMAS + Sheets adapter (with JSON fallback)
    drive.js                    Drive adapter (with local-files fallback)
  local/
    json-store.js               JSON-file backend (atomic writes + per-table mutex)
    file-store.js               public/uploads/ backend

middleware.js                   JWT cookie gate for protected routes
next.config.js, tailwind.config.js, postcss.config.js, jsconfig.json
vercel.json                     Per-route maxDuration overrides
```

---

## 7. Document types

Defined in `lib/utils.js` as `DOCUMENT_TYPES`:

| Type              | Prefix | Taxable | Affects stock | Affects outstanding | PDF title         |
|-------------------|--------|---------|---------------|---------------------|-------------------|
| Tax Invoice       | INV    | yes     | yes           | yes                 | TAX INVOICE       |
| Proforma Invoice  | PI     | yes     | no            | no                  | PROFORMA INVOICE  |
| Purchase Order    | PO     | yes     | no            | no                  | PURCHASE ORDER    |
| Delivery Challan  | DC     | no      | yes           | no                  | DELIVERY CHALLAN  |
| Quotation         | QT     | yes     | no            | no                  | QUOTATION         |

- **Prefix-based auto-numbering**: `nextInvoiceNumber()` finds the max existing number for the same prefix + month and increments. Format `INV-202605-0007`.
- **Editable**: the create-invoice page shows the next-suggested number in an editable field with a regenerate button (↻). Manually-entered duplicates are rejected by the server (409).
- **Per-type form**: switching the doc-type pill bar adapts the form — Delivery Challan hides rate/GST/discount columns and the "Amount received" field, etc.
- **PDF**: same template, dynamic title, `showTax: false` for Delivery Challan strips price/tax columns.

---

## 8. Projects (BOQ-driven billing)

A **Project** is a per-customer container for a Bill of Quantities (BOQ) and a fixed contract value. Tax Invoices billed against the project chip away at the contract; the dashboard shows live progress.

### Schema

```
projects: id, companyId, customerId, name, code, description,
          boqItems[], contractValue, startDate, endDate,
          status (Active|On Hold|Completed|Cancelled),
          notes, createdAt, updatedAt
```

`boqItems` rows: `{ name, description, hsnCode, quantity, unit, rate, gstRate, amount }`. `amount` is auto-computed as `quantity × rate`. The contract value defaults to `Σ(amount) + estimated GST`, and can be **overridden** in the create/edit form.

### Linking sales to projects

`sales` has a `projectId` column. When creating an invoice:

1. Pick the project in the **Document details** card. The customer auto-fills (and locks) to the project's customer.
2. Click **Bill from BOQ** to open a dialog that lets you tick BOQ rows and override the bill quantity (perfect for milestone billing).
3. Picked rows are appended (or replace the empty starter row) as invoice line items with rate/HSN/GST pre-filled.

### Financial accounting rules

Only **Tax Invoice** documents move project numbers. PI / PO / Delivery Challan / Quotation tied to a project show up in the linked-invoices list but don't accrue billed/collected. (Matches Indian GST practice — only the tax invoice is the chargeable bill.)

### Per-project summary

`GET /api/projects/[id]/summary` returns:

```json
{
  "contractValue": 500000,
  "billed":        350000,
  "collected":     200000,
  "pending":       150000,
  "remaining":     150000,
  "overBilled":         0,
  "billedPercent":     70,
  "collectedPercent":  40,
  "invoices": [...]
}
```

### Dashboard widget

- 4-stat strip: Active projects, Total contract value, Billed against contracts, Collected against contracts
- Up to 6 active project tiles with mini progress bars (blue = billed, green = collected)
- Click any tile → project detail

---

## 9. AI Purchase Reader

`/purchase/ai-upload` — two-screen flow.

1. **Upload screen** — drop area + "Extract with AI" CTA
2. **Review screen** — two columns:
   - **Left**: file metadata + embedded PDF preview (`URL.createObjectURL` → iframe)
   - **Right**: AI Extraction Result panel
     - Confidence badge (High ≥85% / Medium ≥60% / Low) computed from extraction completeness
     - Editable VENDOR NAME / DATE / GSTIN / BILL NUMBER
     - Item cards with SKU, HSN, Qty, Unit, Rate, GST%, Discount, live total
     - Live totals box (Subtotal, CGST/SGST or IGST, Total Tax, Grand Total)
     - Sticky action bar: **Save Draft** (status Pending, no inventory) / **Approve & Add to Inventory**
3. The original PDF is uploaded to Drive `purchases/` (or `public/uploads/purchases/` locally) and linked from the purchase row.

The Gemini call (`lib/ai.js`) uses `gemini-1.5-flash` with structured `responseMimeType: "application/json"` and a strict schema prompt; falls back to regex JSON extraction if the model includes any preamble.

---

## 10. PDF generator

`lib/pdf.js` — `generateInvoicePdf({ company, customer, invoice, title, showTax, output })`:

- `jspdf-autotable` handles long item tables across pages
- `didDrawPage` redraws the brand header on every additional page
- `ensureSpace(pts)` inserts a `doc.addPage()` before totals / bank / T&C / notes blocks if they wouldn't fit
- `doc.splitTextToSize` wraps long T&C and notes blocks
- Signature is placed on the **last page bottom-right only**
- Footer with "Page X of Y" rendered in a final pass
- Dynamic title (TAX INVOICE / PROFORMA INVOICE / PURCHASE ORDER / DELIVERY CHALLAN / QUOTATION)
- `showTax: false` strips rate/tax columns (Delivery Challan)
- `output` modes: `"buffer"` (server, default), `"blob"` (browser), `"datauri"`

---

## 11. GST engine

`lib/gst.js`:

- `GST_SLABS = [0, 5, 12, 18, 28]`
- `gstStateFromGstin(gstin)` — first 2 chars
- `isInterstate(supCode, recCode)` — string compare
- `computeLine(item, interstate)` — `taxable = qty*price − discount`; tax split into CGST+SGST or IGST
- `computeInvoice({ items, supplierStateCode, recipientStateCode, invoiceDiscount })` — sums lines, applies invoice-level discount, round-off
- `numberToWords(num)` — Indian-style words ("One Lakh Twenty Thousand …")
- `formatINR` — ₹1,00,000.00 grouping

---

## 12. Storage backends

### Google Sheets (`lib/google/sheets.js`)

- One tab per "table" — schemas defined in `SCHEMAS` (single source of truth)
- Auto-bootstrap: first call creates missing tabs and writes header row
- CRUD: `bootstrap`, `listAll`, `findWhere`, `findOne`, `findById`, `insert`, `update`, `remove`
- `items` and `boqItems` columns auto-serialize JSON
- **Adapter dispatch**: when `DATA_BACKEND=json` (or no Google creds), all calls re-route to `lib/local/json-store.js`

### Google Drive (`lib/google/drive.js`)

- `uploadFile({ data, filename, mimeType, subfolder, makePublic })` — creates subfolder if missing, uploads, optionally marks public-readable
- Returns `{ id, name, viewUrl, downloadUrl, embedUrl }`
- **Adapter dispatch**: when `STORAGE_BACKEND=local` (or no Google creds / no folder ID), all calls re-route to `lib/local/file-store.js` which writes under `public/uploads/<subfolder>/`

### JSON store (`lib/local/json-store.js`)

- One JSON file per table at `.data/<table>.json`
- Atomic writes (`.tmp` then `rename`)
- Per-table promise chain mutex to serialize concurrent writes

### Local file store (`lib/local/file-store.js`)

- Writes to `public/uploads/<subfolder>/<timestamp>-<filename>`
- Returns `/uploads/...` URLs (Next.js serves them automatically)

---

## 13. API endpoints

All write endpoints require auth. Company-scoped endpoints accept the company via the `x-company-id` header (the client's `api()` helper sets this automatically from `localStorage`).

| Method | Path                              | Notes                                       |
|--------|-----------------------------------|---------------------------------------------|
| POST   | `/api/auth/signup`                | email, password, name                       |
| POST   | `/api/auth/login`                 | email, password                             |
| POST   | `/api/auth/logout`                |                                             |
| GET    | `/api/auth/me`                    |                                             |
| POST   | `/api/auth/forgot`                | returns reset URL when email isn't wired    |
| POST   | `/api/auth/reset`                 | email, token, password                      |
| GET    | `/api/auth/google`                | starts OAuth                                |
| GET    | `/api/auth/google/callback`       | OAuth completion                            |
| GET/POST | `/api/companies`                | scoped to current user                      |
| GET/PUT/DELETE | `/api/companies/[id]`     |                                             |
| GET/POST | `/api/customers`                | requires x-company-id                       |
| GET/PUT/DELETE | `/api/customers/[id]`     |                                             |
| GET/POST | `/api/inventory`                |                                             |
| GET/PUT/DELETE | `/api/inventory/[id]`     |                                             |
| GET/POST | `/api/projects`                 | scoped to current company                   |
| GET/PUT/DELETE | `/api/projects/[id]`      |                                             |
| GET    | `/api/projects/[id]/summary`      | contract/billed/collected/pending/remaining |
| GET/POST | `/api/sales`                    | auto-numbering, doc-type, projectId         |
| GET/PUT/DELETE | `/api/sales/[id]`         |                                             |
| GET    | `/api/sales/[id]/pdf`             | streams PDF; `?save=1` persists to Drive    |
| GET/POST | `/api/purchases`                | POST also creates/updates inventory rows    |
| GET/PUT/DELETE | `/api/purchases/[id]`     |                                             |
| POST   | `/api/ai/parse-pdf`               | multipart `file` field, returns JSON        |
| POST   | `/api/upload`                     | multipart `file` + `subfolder`              |
| GET    | `/api/reports/dashboard`          | totals, monthly chart, low-stock, projects  |
| GET    | `/api/reports/gst?from&to`        | GSTR-friendly summary                       |
| GET    | `/api/reports/export?type=...`    | XLSX (sales/purchases/customers/inventory)  |

Response shape: `{ ok: true, data }` on success, `{ ok: false, error }` on failure.

---

## 14. Client `api()` helper

In `components/company-context.jsx`:

- Auto-injects `x-company-id` from `localStorage.bb.activeCompanyId`
- Auto-sets `content-type: application/json` for non-FormData bodies
- For company-scoped paths (`/api/customers`, `/api/inventory`, `/api/sales`, `/api/purchases`, `/api/reports`):
  - **GET** with no active company → returns `[]` (or `null` for reports) so empty states render cleanly
  - **Write** with no active company → throws "Select or create a company first"
- Throws an `Error` with `.status` for non-2xx responses

The CompanyProvider auto-syncs the active company to localStorage on first load, so even if the user never opens the switcher dropdown manually, `api()` always sees the correct id.

---

## 15. Architecture: where does what run

This is one Next.js project but it deploys as **three things working together**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                               │
│   - React UI (sidebar, forms, charts, PDF preview, AI review)       │
│   - localStorage stores active companyId                            │
└──────────────────────┬──────────────────────────────────────────────┘
                       │  HTTPS (your-app.vercel.app)
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     VERCEL (free or Pro)                            │
│                                                                     │
│   Frontend (static / SSR pages):                                    │
│     /, /login, /dashboard, /sales, /projects, …                     │
│     Served as Next.js routes from the Edge / Node runtime           │
│                                                                     │
│   Backend (serverless functions, one per file under /app/api):      │
│     /api/auth/*       JWT signup/login/logout/me                    │
│     /api/companies    /api/customers   /api/inventory               │
│     /api/projects     /api/sales       /api/purchases               │
│     /api/sales/[id]/pdf   ← runs jsPDF, returns the PDF             │
│     /api/ai/parse-pdf     ← calls Gemini, returns JSON              │
│     /api/upload           ← streams file to Drive                   │
│     /api/reports/*        ← aggregations                            │
│                                                                     │
│   Middleware:                                                       │
│     middleware.js verifies the JWT cookie before any protected      │
│     route is even hit by a function.                                │
│                                                                     │
│   Env vars (set in Vercel dashboard, never in the repo):            │
│     JWT_SECRET, GOOGLE_CREDENTIALS_BASE64, GEMINI_API_KEY, …        │
└──────────────────────┬─────────────────────┬────────────────────────┘
                       │                     │
                       ▼                     ▼
┌──────────────────────────────────┐  ┌────────────────────────────────┐
│     GOOGLE SHEETS (the DB)       │  │   GOOGLE DRIVE (file storage)  │
│                                  │  │                                │
│  One spreadsheet, one tab per    │  │  One folder, with subfolders:  │
│  table:                          │  │                                │
│   • Users                        │  │   /invoices/   PDFs of bills   │
│   • Companies                    │  │   /logos/      Company logos   │
│   • Customers                    │  │   /purchases/  AI-uploaded PDFs│
│   • Inventory                    │  │                                │
│   • Sales                        │  │  Files made public-read so the │
│   • Purchases                    │  │  customer can open the PDF link│
│   • Projects                     │  │  in WhatsApp/Email.            │
│   • Payments                     │  │                                │
│                                  │  │  Auth: same service account    │
│  Auth: Vercel functions talk to  │  │  with Drive API enabled.       │
│  Sheets API using a Google       │  │                                │
│  service-account key (JSON →     │  │                                │
│  base64 → env var on Vercel).    │  │                                │
└──────────────────────────────────┘  └────────────────────────────────┘
                       ▲
                       │ (only for AI Purchase Reader)
                       │
┌──────────────────────────────────┐
│        GOOGLE GEMINI API         │
│  gemini-1.5-flash, JSON mode     │
│  reads supplier PDF → JSON       │
└──────────────────────────────────┘
```

**What runs where:**

| Layer            | Where                                  | What it does                                                  |
|------------------|----------------------------------------|---------------------------------------------------------------|
| UI (React)       | Vercel (CDN/edge)                      | Renders pages, handles form state, calls `/api/*`             |
| Auth gate        | Vercel Edge Middleware                 | Verifies JWT cookie before protected routes/APIs              |
| Business logic   | Vercel Serverless Functions (`/api/*`) | CRUD, GST math, PDF gen, AI calls, file uploads               |
| Database         | Google Sheets                          | Persistent rows for users / companies / customers / etc.      |
| File storage     | Google Drive                           | Invoice PDFs, company logos, uploaded purchase PDFs           |
| AI extraction    | Google Gemini API                      | Reads supplier invoice PDFs into structured JSON              |

**Data flow (creating an invoice):**

1. User fills the form in the browser
2. Browser POSTs to `/api/sales` (a Vercel function)
3. Function verifies the JWT cookie (middleware) and the `x-company-id` header
4. Function reads existing sales from **Sheets** to compute the next invoice number
5. Function writes a new row to the **Sales** tab in **Sheets** and updates inventory + customer outstanding rows in their tabs
6. Browser receives `{ ok, data }` and navigates to the invoice detail page
7. User clicks **Save to Drive** → another function streams a generated PDF to **Drive** under `/invoices/<number>.pdf`, marks it public-read, stores the share URL on the row in Sheets

**No traditional database is involved** — Sheets is your DB. That keeps cost at ₹0 and lets non-technical users open the spreadsheet to inspect records directly. Switching to Postgres later means swapping `lib/google/sheets.js` for a SQL adapter; nothing else changes.

---

## 16. End-to-end: Vercel + Sheets + Drive (recipe)

A condensed checklist that takes you from zero to a live deploy in ~15 minutes. Detailed instructions for each step are in the sections below.

```
☐ 1. Google Cloud
   ├── Create project
   ├── Enable Google Sheets API
   ├── Enable Google Drive API
   ├── Create a service account → download its JSON key
   └── Note the service account email
☐ 2. Google Sheets
   ├── Create a blank spreadsheet
   ├── Share with the service-account email as Editor
   └── Copy the spreadsheet ID from the URL
☐ 3. Google Drive
   ├── Create a folder
   ├── Share with the service-account email as Editor
   └── Copy the folder ID from the URL
☐ 4. Gemini (only for AI Purchase Reader)
   └── Get an API key from ai.google.dev
☐ 5. Code
   ├── git init / push to GitHub (.gitignore already excludes secrets)
   └── (optional) npm run build locally to confirm it builds
☐ 6. Vercel
   ├── Import the GitHub repo
   ├── Set env vars (table below)
   └── Deploy
☐ 7. Verify
   ├── Open https://<app>.vercel.app
   ├── Sign up → check Sheets gets a Users tab + your row
   ├── Create a company → check Companies tab
   └── Create an invoice + Save to Drive → check the /invoices folder
```

**Minimum env vars to paste into Vercel** (Project → Settings → Environment Variables):

| Key                              | Where it comes from                                                      |
|----------------------------------|--------------------------------------------------------------------------|
| `JWT_SECRET`                     | `openssl rand -hex 32` (or any long random string)                       |
| `GOOGLE_CREDENTIALS_BASE64`      | `base64 -w0 service-account.json` (Linux) / PowerShell snippet (Windows) |
| `GOOGLE_SHEETS_SPREADSHEET_ID`   | The ID from the spreadsheet URL                                          |
| `GOOGLE_DRIVE_FOLDER_ID`         | The ID from the Drive folder URL                                         |
| `GEMINI_API_KEY`                 | ai.google.dev → Get API key (free)                                       |
| `NEXT_PUBLIC_APP_URL`            | `https://<your-app>.vercel.app`                                          |

After deploy, the **first sign-up bootstraps the spreadsheet**: BillBharat creates the `Users`, `Companies`, `Customers`, `Inventory`, `Sales`, `Purchases`, `Payments`, `Projects` tabs with correct headers automatically. You don't pre-create them.

---

## 17. Deploying to Vercel — step by step

This deploys the same code that you run locally. The only difference is that Vercel needs the env vars and you typically use the Sheets/Drive backend (so data isn't reset on cold deploys).

### 17.1 Prep your Google project for production

You can reuse the same service account, spreadsheet and Drive folder from local dev — there's nothing dev-only about them. Or create separate ones for prod.

If you want **Google login** in prod, also configure the OAuth client:

1. Google Cloud → **APIs & Services → Credentials → Create credentials → OAuth client ID**
2. Application type: **Web application**
3. Authorized redirect URIs:
   - `https://your-app.vercel.app/api/auth/google/callback`
   - (Add `http://localhost:3000/api/auth/google/callback` too if you want local Google login)
4. Note the client ID and client secret

### 17.2 Push to GitHub

```bash
git init
git add .
git commit -m "BillBharat initial"
git branch -M main
git remote add origin https://github.com/<you>/billbharat.git
git push -u origin main
```

The repo's `.gitignore` already excludes `.data/`, `public/uploads/`, `.env*`, `service-account.json` and `node_modules`. Don't override that.

### 17.3 Import on Vercel

1. https://vercel.com → **Add New… → Project**
2. Pick your GitHub repo
3. Framework preset: **Next.js** (auto-detected)
4. Root directory: leave as is
5. Build command: leave as is (`next build`)
6. Output directory: leave as is

Don't click Deploy yet — set env vars first.

### 17.4 Set environment variables on Vercel

In the import screen (or **Project → Settings → Environment Variables** after creation), add:

| Key                                | Value                                                                        | Env scope        |
|------------------------------------|------------------------------------------------------------------------------|------------------|
| `JWT_SECRET`                       | a long random string (run `openssl rand -hex 32`)                            | Production       |
| `GOOGLE_CREDENTIALS_BASE64`        | base64 of your service-account.json (one line, no newlines)                  | Production       |
| `GOOGLE_SHEETS_SPREADSHEET_ID`     | the sheet id                                                                 | Production       |
| `GOOGLE_DRIVE_FOLDER_ID`           | the folder id                                                                | Production       |
| `GEMINI_API_KEY`                   | from ai.google.dev                                                           | Production       |
| `NEXT_PUBLIC_APP_URL`              | `https://your-app.vercel.app`                                                | Production       |
| `GOOGLE_OAUTH_CLIENT_ID`           | (optional) your OAuth client id                                              | Production       |
| `GOOGLE_OAUTH_CLIENT_SECRET`       | (optional) your OAuth client secret                                          | Production       |
| `GOOGLE_OAUTH_REDIRECT_URI`        | (optional) `https://your-app.vercel.app/api/auth/google/callback`            | Production       |

Encode the JSON for `GOOGLE_CREDENTIALS_BASE64`:

```bash
# Linux / macOS / Git Bash
base64 -w0 service-account.json

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
```

Paste the entire result into the value field. **Do not** wrap it in quotes; Vercel handles that.

> Tip: copy the same vars to "Preview" and "Development" scopes if you want previews and `vercel dev` to work too.

### 17.5 Deploy

Click **Deploy**. The first build takes ~2–3 min.

When the deployment is green:

1. Open your `https://your-app.vercel.app` URL
2. Sign up — your user goes into the spreadsheet
3. Create a company and verify the spreadsheet now has new tabs

The first request takes ~3–5 s as the app creates the seven sheet tabs (`Users`, `Companies`, `Customers`, `Inventory`, `Sales`, `Purchases`, `Payments`, `Projects`). Subsequent requests are fast.

### 17.6 Custom domain (optional)

Vercel → **Project → Settings → Domains** → add your domain → follow the DNS instructions. Once linked, also update:

- `NEXT_PUBLIC_APP_URL` to the new domain
- `GOOGLE_OAUTH_REDIRECT_URI` (if using Google login)
- The redirect URI in Google Cloud Console

Redeploy after env-var changes (Vercel does this automatically on save in most cases).

### 17.7 Subsequent deployments

Push to `main` → Vercel auto-deploys. Push to any other branch → preview deployment. To roll back, go to **Deployments** and promote a previous one.

---

## 18. Vercel free vs Pro

| Concern                       | Hobby (free)                | Pro ($20/mo)                |
|-------------------------------|------------------------------|------------------------------|
| Commercial use                | not allowed by ToS           | allowed                      |
| Function timeout              | 60 s                         | 300 s                        |
| Request body size             | ~4.5 MB                      | larger                       |
| Bandwidth                     | 100 GB / mo                  | 1 TB included                |
| Cold starts                   | longer                       | faster                       |
| Team / collaboration          | personal                     | team features                |

For this app, Hobby works for personal use, demos and light testing. For real invoicing of customers (commercial), Pro is the honest answer. The Google side (Sheets API + Drive API + Gemini free tier) costs ₹0 at this scale.

---

## 19. Troubleshooting

### "Loading…" never finishes on a page
Fixed in this repo: the CompanyProvider now syncs localStorage on first load and reports pages have proper loading/error/empty states. If you hit it again:
- Open DevTools → Network → does the API call return a 4xx/5xx?
- Check the response body for the `error` message

### `companyId required`
You hit a company-scoped API before any company exists. Either create a company first or set `DEV_BYPASS_AUTH=1` to preview the chrome.

### "Google service account credentials missing"
You set `DATA_BACKEND=google` but didn't provide credentials. Either:
- Set `GOOGLE_CREDENTIALS_JSON` or `GOOGLE_CREDENTIALS_BASE64`
- Or remove `DATA_BACKEND` and let it auto-fall-back to JSON

### `403` from Sheets / Drive
The service account email is not shared on the spreadsheet / folder. Open them in the browser, click Share, paste the email (`...@...iam.gserviceaccount.com`) as Editor.

### AI parser returns blank items
The PDF is image-only / scanned. `gemini-1.5-flash` reads text, not raster pixels at high accuracy. Use a cleaner PDF or upgrade to a higher-tier model in `lib/ai.js`.

### Vercel build fails
- Look at the Deploy logs in Vercel
- Locally run `npm run build` to reproduce
- Common cause: a typo in JSX or a missing import

### Sidebar shows two active items
Already fixed — the active link is now the longest matching href. If you add a new nested route, you don't need to touch anything.

### Headers in the spreadsheet are wrong
Don't edit them manually. The bootstrap routine compares headers against `SCHEMAS` and overwrites if they differ. Just refresh the page.

### Vercel function exceeds 60s
Mostly happens with very large AI extractions or very large invoice PDFs. The `vercel.json` sets `maxDuration: 60` for AI and PDF endpoints. On Pro you can raise this to 300.

---

## 20. Build log — everything done so far

### Initial scaffold
- Next.js 14 (App Router) project with Tailwind + shadcn-style components
- JWT auth (signup/login/logout/me/forgot/reset + Google OAuth optional)
- Multi-company shell with localStorage-backed switcher
- Customers / Inventory / Sales / Purchases CRUD with multi-tenant guards
- GST engine (CGST/SGST/IGST split, slabs, words)
- jsPDF tax-invoice generator with bank + T&C
- Gemini AI Purchase PDF parser (`gemini-1.5-flash`, JSON-mode)
- Reports: dashboard, sales, GST, finance + Excel export
- Drive uploader for invoices, logos, purchase PDFs
- Vercel-ready (`vercel.json` per-route maxDuration)

### Local dev mode
- `lib/local/json-store.js` — JSON-file table store with atomic writes + mutex
- `lib/local/file-store.js` — uploads under `public/uploads/`
- Sheets and Drive adapters dispatch to JSON/local automatically when Google creds are absent
- `DEV_BYPASS_AUTH=1` flag to skip auth entirely for UI preview
- `(app)/layout.jsx` tolerates Sheets unavailability — empty companies on first run

### Document types feature
- `DOCUMENT_TYPES` registry (Tax Invoice / PI / PO / DC / QT)
- Added `documentType` column to sales schema
- Per-type prefixes for auto-numbering (`INV`, `PI`, `PO`, `DC`, `QT`)
- API strips tax for non-taxable docs; only Tax Invoice/Delivery Challan touch stock; only Tax Invoice tracks outstanding
- Create-invoice page rewritten with pill-bar type selector, editable invoice number with regenerate button, columns adapt to type
- Sales list adds type filter + "New" dropdown by type
- Sale detail shows type pill

### PDF page-break overhaul
- Brand header redrawn on every additional page via autoTable's `didDrawPage`
- `ensureSpace()` inserts `addPage()` before totals/bank/T&C/notes blocks
- Long text wrapped via `splitTextToSize`
- Signature anchored to last page only
- Page X of Y footer
- Dynamic title + `showTax` flag (Delivery Challan PDF hides tax columns)

### Customer detail page
- `/customers/[id]` — summary cards (docs/billed/collected/outstanding), inline edit form, full bill history with type filter and PDF view
- Customers list links to detail; added FileText shortcut button
- Sales create-invoice accepts `?customer=<id>` to pre-fill

### AI Purchase Reader redesign
- Two-column review layout
- Embedded PDF preview via `URL.createObjectURL` + iframe
- Confidence badge (High/Medium/Low) computed from extraction completeness
- Editable vendor + bill fields, item cards with all fields editable
- Live totals recompute as you edit
- Sticky action bar: Save Draft / Approve & Add to Inventory
- Original PDF persisted to storage and linked to the purchase row

### Stability fixes
- Sidebar: only the longest-matching href is highlighted
- `api()` helper: graceful empty-payload short-circuit for company-scoped endpoints when no company is selected
- Every `useEffect` data-loader gated on `active?.id` and given a `.catch` so nothing surfaces in Next's error overlay
- CompanyProvider: syncs localStorage on first auto-select so `api()` always has the right company id
- Reports pages (gst, finance) and dashboard now have proper loading / error / empty states with retry instead of getting stuck on "Loading…"

### Projects + BOQ feature
- New `projects` table with `boqItems[]` JSON column and `contractValue`
- New `projectId` column on `sales`; sales API validates project ↔ customer alignment
- API: `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/[id]`, `GET /api/projects/[id]/summary`
- Pages: `/projects` (card grid, filter, progress), `/projects/create` (BOQ editor with auto contract value + override), `/projects/[id]` (summary, progress bar, BOQ table, linked invoices, inline edit, "Bill against project" CTA)
- Reusable `BoqEditor` and `ProgressBar` components
- Sidebar entry "Projects (BOQ)"
- `/api/reports/dashboard` now includes project totals + top-6 active project stats
- Dashboard renders a 4-stat project strip and a project-progress card with mini bars
- Create-invoice page: optional Project picker (filtered by customer); "Bill from BOQ" milestone dialog imports BOQ rows with override-able quantities

---

## 21. Roadmap

These are common asks that would slot in cleanly:

- **Recurring invoices** (cron) — Vercel Cron + a `schedules` table
- **Email integration** for forgot-password and invoice send (Resend / SendGrid)
- **Two-factor auth** for admin-role accounts
- **PWA / offline mode** — service worker + cached views
- **Barcode scanning** for inventory in/out via the camera
- **Role-based access** — staff vs admin within a company
- **Customer portal** — let parties view their invoices and pay via Razorpay/UPI link
- **e-Invoicing IRN** integration with NIC for businesses above the GST threshold
- **Multi-currency** for export-oriented businesses

---

## 22. Useful commands

```bash
# Local development
npm install
npm run dev               # http://localhost:3000

# Production build (test it locally before deploying)
npm run build
npm run start

# Linting
npm run lint

# Reset local data
rm -rf .data public/uploads                          # Bash / Git Bash
Remove-Item -Recurse -Force .data, public/uploads    # PowerShell

# Inspect a JSON table (Bash + jq)
cat .data/sales.json | jq

# Encode service-account.json for Vercel
base64 -w0 service-account.json                                                # Linux / macOS
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))     # PowerShell

# Generate a JWT secret
openssl rand -hex 32
```

---

End of guide. Keep this updated whenever you touch schemas, routes, or env vars — it stays the canonical reference.
