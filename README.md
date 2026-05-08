# BillBharat

Modern, GST-compliant invoicing, inventory, purchase and finance app for Indian businesses. Next.js 14 (App Router) on Vercel, with **Google Sheets as the database** and **Google Drive as file storage**. AI parses purchase PDFs (Gemini) and auto-updates inventory.

## Features

- Auth: email/password + optional Google OAuth + forgot/reset password (JWT cookies)
- Multi-company (GSTIN, PAN, bank, T&C, logo) with a top-bar company switcher
- Customers/parties with credit limits and live outstanding balances
- Inventory with HSN, GST slab, stock and low-stock alerts
- GST-compliant invoices: auto-numbering, CGST/SGST or IGST based on state, discounts, line + invoice level, amount in words, branded PDF
- Purchases: supplier bills with auto-inventory increase
- **AI Purchase Reader**: upload supplier PDFs, Gemini extracts items + tax, you review and save
- Reports: sales, GST input/output, finance overview, customer outstanding (Excel export)
- Drive-backed file storage for invoices, logos and uploaded purchase PDFs

## Tech

`Next.js 14 · React 18 · Tailwind · jsPDF · Google Sheets/Drive APIs · Gemini · JWT (jose) · bcrypt · Recharts`

## 1. Google setup (one-time)

1. **Create a Google Cloud project** at https://console.cloud.google.com.
2. Enable **Google Sheets API** and **Google Drive API**.
3. **Create a service account**: IAM & Admin → Service Accounts → Create. Generate a JSON key and download it.
4. **Create a Google Sheet** (any name). Share it with the service account email (`...@...iam.gserviceaccount.com`) as **Editor**. Copy the spreadsheet ID (`https://docs.google.com/spreadsheets/d/<ID>/edit`). The app auto-creates the required tabs on first run.
5. **Create a Google Drive folder** for files. Share it with the same service account email as **Editor**. Copy its folder ID.

## 2. Environment

Copy `.env.example` to `.env.local` and fill in:

```
JWT_SECRET=<long random string>
GOOGLE_CREDENTIALS_JSON=<paste the entire service-account JSON on one line>
# OR — recommended for Vercel — base64-encode the JSON:
# GOOGLE_CREDENTIALS_BASE64=<base64 of the JSON file>
GOOGLE_SHEETS_SPREADSHEET_ID=<sheet id>
GOOGLE_DRIVE_FOLDER_ID=<folder id>
GEMINI_API_KEY=<from ai.google.dev>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Optional Google login:

```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

## 3. Run locally

```bash
npm install
npm run dev
```

Visit http://localhost:3000.

1. **Sign up** with any email/password.
2. You'll be redirected to **Companies → Create** to set up your first business (GSTIN, bank, terms).
3. Add a customer, add a few inventory items, then create your first invoice — download the PDF, save to Drive, share via WhatsApp.

## 4. Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project on Vercel.
3. Add the same env vars from your `.env.local` as Vercel **Project Settings → Environment Variables**.  
   For the credentials JSON, use **`GOOGLE_CREDENTIALS_BASE64`** — paste the base64 of your service-account file (Vercel preserves multiline poorly):
   ```bash
   base64 -w0 service-account.json   # Linux
   certutil -encode -f service-account.json out.txt && type out.txt  # Windows
   ```
4. Set `NEXT_PUBLIC_APP_URL` to your production URL. If using Google login, also update `GOOGLE_OAUTH_REDIRECT_URI` and the redirect in Google Cloud Console.
5. Deploy. The first request bootstraps the spreadsheet tabs.

## Architecture

```
/app
  /(auth)           - login, signup, forgot/reset (public)
  /(app)            - protected app shell (sidebar + topbar)
    /dashboard
    /companies
    /customers
    /inventory
    /sales          - invoice list, /create-invoice, /[id] view
    /purchase       - list, /create, /ai-upload (AI reader)
    /reports        - sales, gst, finance
  /api
    /auth/*         - login/signup/logout/me/forgot/reset/google
    /companies      - CRUD
    /customers      - CRUD
    /inventory      - CRUD
    /sales          - CRUD + /[id]/pdf (download or save to Drive)
    /purchases      - CRUD
    /ai/parse-pdf   - Gemini multimodal extractor
    /upload         - file → Drive
    /reports/*      - dashboard, gst, export (xlsx)
/components         - sidebar, topbar, company-context, ui/* primitives, forms
/lib
  /google
    auth.js         - service-account auth client
    sheets.js       - schema + CRUD over Google Sheets
    drive.js        - upload/download/delete files
  auth.js           - JWT session helpers (jose)
  api.js            - response helpers
  db.js             - company access checks
  gst.js            - GST engine + amount-to-words
  pdf.js            - branded jsPDF invoice generator
  ai.js             - Gemini PDF→JSON parser
  utils.js          - cn(), formatINR, state list, invoice numbering
middleware.js       - JWT cookie gate for protected routes
```

## GST rules implemented

- 2-digit state code is read from the GSTIN prefix (or set explicitly per customer/company).
- Same state → CGST (rate/2) + SGST (rate/2) on the taxable value.
- Different state → IGST (full rate).
- Slabs: 0%, 5%, 12%, 18%, 28% (configurable per-line).
- Discounts can be applied per line and on the whole invoice; both reduce the taxable value before tax.
- Round-off and amount-in-words are auto-included on the PDF.

## Notes & extensibility

- The Sheets adapter (`lib/google/sheets.js`) is a generic key-value-row store. Add a new entity by extending `SCHEMAS` and the app handles bootstrap, CRUD and serialization.
- Sheets is great for low/medium write traffic (a small business). For larger workloads, swap `lib/google/sheets.js` for any DB; the rest of the app does not care.
- The forgot-password flow generates a one-hour reset link. Wire your favourite email service (Resend/SendGrid) to mail it; until then the link is returned in the response for development.
- `/api/sales/[id]/pdf?save=1` persists the PDF to Drive and stores the share URL on the sale row.
- The AI parser uses `gemini-1.5-flash` with structured JSON output. Swap to OpenAI by editing `lib/ai.js`.
- Multi-tenant safety: every API route checks `companyId` ownership via `assertCompanyAccess`.

## Common issues

- *"GOOGLE_SHEETS_SPREADSHEET_ID not set"* — the spreadsheet id env var is missing.
- *403 from Sheets/Drive* — share the sheet/folder with the service-account email, not your personal Google account.
- *AI parse returns blank items* — the PDF is image-only; only text-based PDFs are supported by the default model. Use a higher-tier multimodal model if you need OCR.
- *Cold starts* — first request to the app boots the sheet (auto-creates tabs). Subsequent requests are fast.

Built with care for Indian SMBs.
