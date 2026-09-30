# BillBharat

GST-compliant invoicing, inventory, purchase and finance app for Indian businesses — packaged as an **offline Windows desktop application**. Everything lives on the machine it runs on: a single SQLite file and a folder of PDFs, in the spirit of Tally. No server, no account, no cloud.

## Features

- Multi-company (GSTIN, PAN, bank, T&C, logo) with a top-bar company switcher
- Customers/parties with credit limits and live outstanding balances
- Inventory with HSN, GST slab, stock and low-stock alerts
- GST-compliant invoices: auto-numbering, CGST/SGST or IGST by state, line- and invoice-level discounts, amount in words, branded PDF
- Purchases: supplier bills with auto-inventory increase, payment tracking
- Projects with Bill-of-Quantity tracking (billed vs collected vs contract value)
- Reports: sales, GST input/output, finance overview, daybook, audit log, customer outstanding (Excel export)
- Local email/password login (JWT cookie), so the books aren't open to anyone who opens the app
- *Optional* AI purchase/sales PDF reader — the only feature that uses the internet, and it is off unless you add an API key

## Tech

`Next.js 14 · React 18 · Tailwind · SQLite (node-sqlite3-wasm) · Electron · jsPDF · JWT (jose) · bcrypt · Recharts`

## Where your data lives

| | Path |
|---|---|
| Packaged app | `%APPDATA%\BillBharat\data\` |
| `npm run dev` | `./.data/` (gitignored) |

That folder holds `billbharat.db` (all your books) and `files/` (invoice PDFs, logos, uploaded bills). **Back it up by copying the folder** — the app is closed-file-safe once quit. In the app: **File → Open Data Folder**.

Set `BILLBHARAT_DATA_DIR` to put it somewhere else, e.g. a synced or backed-up drive.

## Run it locally (instant, hot reload)

```bash
npm install
cp .env.example .env.local     # then set JWT_SECRET
npm run dev                    # http://localhost:3000
```

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

To see it in the real desktop window while developing, leave `npm run dev` running and in a second terminal:

```bash
npm run dev:app                # Electron attached to localhost:3000, hot reload intact
```

First run: **Sign up** → you're sent to **Companies → Create** to set up the business (GSTIN, bank, terms) → add a customer and a few inventory items → create your first invoice.

## Build the Windows .exe

```bash
npm run dist
```

Produces in `dist/`:

- `BillBharat-1.0.0-x64.exe` — installer (per-user, adds desktop + start-menu shortcuts)
- `BillBharat-1.0.0-portable.exe` — single file, runs with no installation

Other targets:

```bash
npm run build      # Next.js production build + bundle prep only
npm run dist:dir   # unpacked app in dist/win-unpacked (fastest way to test packaging)
```

The installer deliberately installs per-user into `%LOCALAPPDATA%\Programs\BillBharat` rather than `Program Files`: the bundled Next.js server needs a writable directory for its own runtime cache, which a machine-wide install would deny to a non-admin user. Your data is in `%APPDATA%` either way, so reinstalling never touches the books.

## Check the data layer

```bash
npm run check
```

Runs 17 assertions against a throwaway database — JSON columns, numeric types, filters, foreign keys, the audit log, and persistence across a reopen. Run it after touching anything in `lib/db/`.

## Architecture

```
electron/main.js      - desktop shell: generates the session secret, boots the
                        Next server on a free loopback port, opens the window
scripts/
  prepare-standalone.mjs - folds static assets into the standalone bundle
  check-db.mjs           - data-layer self-check

/app
  /(auth)             - login, signup, forgot/reset (public)
  /(app)              - protected app shell (sidebar + topbar)
    /dashboard /companies /customers /inventory /journals
    /sales            - list, /create-invoice, /[id], /ai-upload
    /purchase         - list, /create, /ai-upload
    /projects         - list, /create, /[id]
    /reports          - sales, gst, finance, daybook, outstanding, audit
  /api
    /auth/*           - login/signup/logout/me/forgot/reset
    /companies /customers /inventory /sales /purchases /projects /payments
    /journals /product-mappings
    /sales/[id]/pdf   - render the invoice PDF; ?save=1 archives a copy
    /files/[...path]  - serves stored files from the data folder (auth required)
    /upload           - file -> data folder
    /ai/*             - optional PDF extractors
    /reports/*        - dashboard, gst, daybook, export (xlsx)
/components           - sidebar, topbar, company-context, ui/* primitives, forms
/lib
  /db
    sqlite.js         - SQLite connection, pragmas, prepared-statement cache
    schema.js         - the schema, inlined; applied on every open
  db.js               - data access layer + company access checks
  paths.js            - resolves the data directory
  storage/local.js    - local disk file storage
  auth.js             - JWT session helpers (jose)
  api.js              - response helpers
  gst.js              - GST engine + amount-to-words
  pdf.js              - branded jsPDF invoice generator
  ai.js               - optional PDF->JSON parser
  utils.js            - cn(), formatINR, state list, invoice numbering
middleware.js         - routing gate: redirects when no session cookie is present
```

### How auth is enforced

`middleware.js` only checks whether a session cookie *exists*, because Next.js middleware runs in the Edge runtime where build-time env inlining would bake in the wrong `JWT_SECRET` — the packaged app generates its secret on first launch. Signatures are verified per request in `getCurrentUser()` (`lib/auth.js`), which every API route reaches through `withUser()`/`requireUser()` and every app page through the `(app)` layout. A forged or expired cookie gets past the redirect and is then rejected server-side.

### Notes on the data layer

- `lib/db.js` is a generic row store. Add an entity by extending `SCHEMAS` and adding the table to `lib/db/schema.js`; CRUD, JSON handling and the audit log come for free.
- Every statement in the schema is `IF NOT EXISTS` and is applied on each open, so adding a table or index is the whole migration.
- The driver is SQLite compiled to WebAssembly rather than a native addon, so one `node_modules` works under both plain Node and Electron — no per-ABI rebuild and no MSVC toolchain to install.
- Multi-tenant safety: every API route checks `companyId` ownership via `assertCompanyAccess`.
- The forgot-password flow generates a one-hour reset link. With no mail service wired up, the link is returned in the response.

## GST rules implemented

- 2-digit state code is read from the GSTIN prefix (or set explicitly per customer/company).
- Same state → CGST (rate/2) + SGST (rate/2) on the taxable value.
- Different state → IGST (full rate).
- Slabs: 0%, 5%, 12%, 18%, 28% (configurable per line).
- Discounts apply per line and on the whole invoice; both reduce the taxable value before tax.
- Round-off and amount-in-words are auto-included on the PDF.

## Common issues

- *"JWT_SECRET not set"* — only affects `npm run dev`; copy `.env.example` to `.env.local` and set it. The packaged app manages its own.
- *AI parse returns blank items* — the PDF is image-only. The default model reads text PDFs; use a higher-tier multimodal model for OCR.
- *AI features error out* — expected with no `OPENROUTER_API_KEY` or `GEMINI_API_KEY`. Everything else works offline.
- *Build hangs on Windows* — a previously started server may still be holding files in `.next`. Close it, then rebuild.

Built with care for Indian SMBs.
