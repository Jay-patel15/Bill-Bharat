# BillBharat — Documentation

The full guide: using the app, where data lives, how it works inside, and how to change it safely.
For the product overview and how to build the `.exe`, see [README.md](README.md).

**Contents**

1. [Using the app](#1-using-the-app)
2. [Settings](#2-settings)
3. [Keyboard](#3-keyboard)
4. [Backups and your data](#4-backups-and-your-data)
5. [How it works](#5-how-it-works)
6. [Developer setup](#6-developer-setup)
7. [Changing the code safely](#7-changing-the-code-safely)
8. [Troubleshooting](#8-troubleshooting)
9. [Not built yet](#9-not-built-yet)

---

## 1. Using the app

### First run

1. **Sign up.** One owner account per install. **Write down the recovery code** shown once: it is the only way to reset the password.
2. **Create your company:** name, GSTIN (its first two digits set your state, which decides CGST+SGST or IGST), PAN, address, phone, bank details, terms.
3. Add customers and items (or create them on the fly with `Alt+C` while billing).
4. Make your first invoice: Sales → New invoice (or `F8`).

**Forgot password:** Login → *Forgot password?* → email + recovery code + new password.

### Daily work

| Task | Where |
|---|---|
| Sales invoice, quotation, proforma, PO, delivery challan | Sales → New (`F8`). Pick the document type at the top. The number is filled in automatically from the company's *invoice number format* (default `INV/26-27/0042`: one series per Indian financial year, April to March, restarting at 0001 on 1 April); the top line shows the previous number issued for that type. The format and layout are changed only in Settings → Invoice template, not while billing. Item names wrap so long names stay fully visible. The summary and the *Save* button are at the bottom, after the items (`Alt+A` also saves). |
| Money received against an invoice | Open the invoice → *Record payment*. Shows in Rojmel as Debit (money in). |
| Purchase bill | Purchases → New (`F9`), or *AI Purchase Reader* to fill it from a PDF/photo. Stock goes up. |
| Paying a supplier | Purchases → the bill → *Record payment*. Shows in Rojmel as Credit (money out). |
| Expense (labour, rent, fuel…) | `F5` (Payment), or Expenses → *Add expense*. Delete with the bin icon. |
| Other cash in / out (capital, loan, withdrawal) | `F6` Receipt / `F5` Payment, or Rojmel → *Receipt (In)* / *Payment (Out)*. |
| Cash deposited in bank, cash withdrawn, UPI to bank | `F4` Contra, or Rojmel → *Contra*. Pick from and to accounts. Delete with the bin icon. |
| Who owes you / whom you owe | Reports → Outstanding → *Customers* or *Suppliers* → *Download PDF*. |
| One party's full account | Reports → Party ledger → pick the party → detailed ledger (every bill and payment, running balance). Tick one or more invoices to limit it to those; *All* shows every invoice → *PDF* prints the same view. |
| GST figures and GSTR-1 JSON | Reports → GST. |

**Rojmel or Expenses?** Rojmel is the whole cash book: every rupee in and out with a running balance. Expenses shows only spending, grouped by head and month. Every expense is also a Rojmel entry, so you enter it once. Invoice receipts and bill payments appear in Rojmel automatically; other cash movements you add by hand.

**Deleting a sale or purchase** puts the stock back and removes its payments and ledger entries.

**Old data missing from Rojmel?** Books made by older versions may lack ledger entries: Rojmel → *Add missing invoice and payment entries* (safe to repeat).

### The invoice PDF

The standard industrial GST tax invoice (A4, bordered):

- **Header:** logo top-left, company name, tagline lines ("Auth.Dist.: …", "MFGRS.OF …"), REGD.OFF. address, Tel / E-Mail.
- **ID strip:** GSTIN / PAN / STATE · TAX INVOICE with the Rule 46 notice and Tax Reverse (N/Y) · Original / Duplicate / Triplicate.
- **Dispatch:** Invoice, Challan and Order numbers and dates (left); LR, Transporter, E-way, Payment and Due on (right). Filled from *Transport & Consignee Details → Add dispatch / consignee details* on the invoice form.
- **Parties:** Receiver/Buyer and Consignee/Ship To with place of supply and GSTIN.
- **Items:** Sr, description, HSN, quantity, rate, unit, disc%, amount, with ruled columns down the page. Total quantity, sub total, discount, CGST/SGST/IGST by rate and round off sit inside the grid.
- **Footer:** amount in words + grand total; bank details + declaration; numbered terms, Receiver's Sign., For company / Auth.Sign.

Dates print as dd/mm/yyyy. **Long bills continue automatically:** each full page ends with "Continued on next page…", the column headings repeat, and totals and footer print once on the last page.

---

## 2. Settings

| Section | What you can change |
|---|---|
| **Company details** | Company name, GSTIN, PAN, phone, email, logo, address, city, pincode, state, **bank name, branch, account number, IFSC**, terms. Saved changes apply to every invoice printed afterwards. *All companies* lists, adds and switches companies. |
| **Invoice template** | *Invoice number format* (see below). Turn each part of the invoice on or off and rename its label; upload the logo; tagline lines; declaration; terms; reverse charge Yes/No. Live A4 preview on the right; tick *Preview a long bill* to see page 2. *Reset to default* restores the standard layout. Saved per company. |
| **Terms & Conditions** | One term per line; printed numbered (1., 2., 3.…) at the foot of every invoice. Same text as in Company details and the template editor. |
| **Backup & Restore** | *Extra backup folders*: up to 5 folders (one per line) that get a copy of every backup; *Save folders* tests that each can be written and makes a first copy. *Back up now* backs up to the backups folder and every extra folder. *Download a copy* saves one `.db` file wherever you choose. *Restore from file…* checks the file and saves the current books before replacing them. See [Keeping backups safe](#keeping-backups-safe-windows-crash-or-drive-reset). |
| **Reset (erase all books)** | *Reset all books…* asks for your **login password**, then deletes every company with its customers, items, invoices, purchases, payments, expenses, ledger, audit log, invoice templates, logo and uploaded bills. Kept: your login, the AI key and backup folders. A full backup `before_reset_<time>.db` is saved first, so *Restore from file…* undoes it. A wrong password erases nothing. |
| **Gemini AI bill reader** | Optional. Paste a key from aistudio.google.com/app/apikey to let the AI read purchase bills. Stored encrypted on this PC. Without it, everything works by hand. |
| **Product master names** | Names the AI reader maps supplier wording onto. |

#### Invoice number format

Settings → Invoice template → *Invoice number format*. It cannot be changed from the invoice form. Saved per company with the template; *Reset to default* restores `{PREFIX}/{FY}/{####}` → `INV/26-27/0042`: numbers keep counting through the months and restart at 0001 on 1 April (Indian financial year). Books from earlier versions that still had the old monthly default (`INV-202610-0042`) switch to this automatically; their old invoices keep their numbers and the new series starts at `INV/26-27/0001`.

| Token | Becomes |
|---|---|
| `{PREFIX}` | INV (Tax Invoice), PI (Proforma), PO (Purchase Order), DC (Delivery Challan), QT (Quotation) |
| `{YYYY}` `{YY}` `{MM}` `{DD}` | Year, 2-digit year, month, day of the document date |
| `{FY}` | Indian financial year (April–March), e.g. `26-27` |
| `{####}` | Running number, zero-padded to the count of `#` (`{###}` → 007). Added at the end if left out. |

The running number restarts at 1 whenever the rest of the number changes: with `{MM}` every month, with `{FY}` every April, with no date token never. Anything else you type is kept as is (e.g. `ABC/{FY}/{###}` → `ABC/26-27/001`). Changing the format does not renumber old bills; numbers already saved stay as they are. Leave out `{PREFIX}` and all document types share one series. You can still overwrite a number on the form; duplicates are refused.

The logo can be any image; it is stored as PNG so it always prints. Bank details are read from the company record each time a PDF is made.

---

## 3. Keyboard

| Key | Action |
|---|---|
| `F4` | **Contra**: opens a new contra entry (move money between Cash, UPI, Bank Transfer, Cheque, e.g. cash deposited in bank). Shows in Rojmel as a credit to the *from* account and a debit to the *to* account. |
| `F5` | **Payment**: opens a new money-out entry (expense, wages, rent, drawings). Also listed in Expenses. |
| `F6` | **Receipt**: opens a new money-in entry (capital, loan, other income). |
| `F8` | **Sales**: new sales invoice. |
| `F9` | **Purchase**: new purchase bill. |
| `Alt+A` | Accept (save) the current form or open dialog |
| `Alt+C` | Quick-create a customer, or an item when in an item grid |
| `F2` | Jump to the date field |
| `Enter` | Next field; on the last cell of the last item row adds a new row; on the last field of a form saves |
| Item search | Type part of a name, SKU, barcode or HSN (`tmt12` finds "TMT Bar 12mm"), `↑`/`↓`, `Enter`. A scanned barcode is picked at once. |
| `Esc` | Close the dialog, or go back |

`F7` is not used (there are no manual journals). The legend is shown at the bottom of every screen.

---

## 4. Backups and your data

| | Path |
|---|---|
| Program files | The folder you choose in the installer (default `%LOCALAPPDATA%\Programs\BillBharat\`). Only the app lives here, not your books. |
| Books (installed app) | `%APPDATA%\BillBharat\data\` (File → Open Data Folder) |
| Backups (installed app) | `%APPDATA%\BillBharat\backups\` (File → Open Backups Folder) |
| Dev (`npm run dev`) | `./.data/` (gitignored) |

- `billbharat.db` holds all books; `files/` holds invoice PDFs, logos and uploaded bills.
- **What a backup holds:** one `.db` file with all companies and books **plus every uploaded file** (logo, purchase-bill PDFs and photos), packed inside it. Restore writes those files back (existing files are kept) and never writes outside the `files` folder.
- **Automatic backups:**
  - **Daily:** `daily_<time>.db`, once per calendar day. It's taken when the app opens, and checked again every hour while it stays open.
  - **Before an update:** `backup_v<old version>_<time>.db`, taken before a new app version or a database upgrade touches the books.
  - **Before risky actions:** a copy is taken before deleting a company or restoring a backup.
  - The last **30 of each kind** are kept, in the backups folder and in every extra folder.
- **Each saved bill is written to disk immediately** (SQLite `synchronous = FULL`), so a Windows crash or power cut cannot lose a bill that was already saved.
- **Copies to extra folders run in the background**, so a slow pen drive, network share or cloud folder never makes billing hang. The daily backup itself takes well under a second (about 0.4 s for 1,500 invoices and 3,000 items) once a day, when the app opens.
- Backups sit beside the data folder, not inside it, so restoring a copied data folder never wipes them.
- To move them, set `BILLBHARAT_DATA_DIR` / `BILLBHARAT_BACKUP_DIR`.

### Keeping backups safe (Windows crash or drive reset)

The data and backups folders are both on C:. If Windows is reinstalled or C: is formatted, both are lost. **Add at least one extra backup folder that is not on C:** (Settings → Backup & Restore → *Extra backup folders*):

| Where | Example folder | Notes |
|---|---|---|
| Google Drive (cloud) | `G:\My Drive\BillBharat Backups` | Install *Google Drive for desktop*, sign in, use a folder under `My Drive`. It uploads each copy by itself. |
| OneDrive / Dropbox (cloud) | `C:\Users\<you>\OneDrive\BillBharat` | On C:, but synced to the cloud, so the cloud copy survives a reset. |
| Pen drive / external disk | `E:\BillBharat` | Only copies while plugged in; a missing drive is reported, not fatal. |
| Another internal drive | `D:\BillBharat Backups` | Survives a Windows reset, not a dead disk. |
| Office PC / NAS share | `\\OFFICE-PC\Backups\BillBharat` | A shared network folder. |

- **A Google Drive *share link* cannot be used.** Uploading through a link needs a Google sign-in and API setup, and the app works offline by design. Use the Drive for desktop folder instead.
- **Reminder:** a yellow bar at the top of every screen appears when there's no extra folder, when nothing has reached the extra folders for 7 days, or when the last copy failed (pen drive unplugged, share offline). The bar links to Settings.
- **After a reset:** install BillBharat, sign up, then go to Settings → *Restore from file…* and pick the newest `.db` from your extra folder. Books, logo and bills come back. Then add the extra folders again (they are a setting of each PC).
- The Gemini key is tied to this PC: after restoring on another PC, enter it again.

---

## 5. How it works

### Architecture

Electron starts a local Next.js server on `127.0.0.1` (free port) and opens a window on it. All data is one SQLite file.

```
electron/main.js          desktop shell: session secret (safeStorage), starts the server, blocks non-local requests
instrumentation.js        server-side network allow-list: only localhost + Gemini
middleware.js             redirects to /login when there is no session cookie
scripts/
  prepare-standalone.mjs  bundle prep: copies assets, strips .env*/.data, checks the sqlite .wasm
  check-db.mjs            self-check (npm run check)
services/ai/gemini_service.js   the only internet-using code: key vault + bill OCR
lib/
  db/sqlite.js            connection, pragmas, migration runner, snapshot/restore, transaction()
  db/schema.js            versioned migrations (tracked in _schema_migrations)
  db.js                   row store (insert/update/remove/find*), access checks, customerDues
  accounting.js           ledger postings: sales, purchases, payments (addPayment), cash vouchers (receipt, payment, contra)
  gst.js                  GST engine, amount in words
  gst-export.js           GSTR-1 JSON
  outstanding.js          outstanding statement and party ledger
  invoice-template.js     invoice print template: defaults, editor sections, sanitizing
  pdf.js                  invoice, outstanding and party statement PDFs
  auth.js, api.js         session cookie, response helpers
  utils.js                dates (localDate), money format, document types, payment modes, fuzzy search
app/(auth)                login, signup, reset (recovery code)
app/(app)                 dashboard, customers, inventory, sales, purchase, expenses, reports/*,
                          settings (+ company, invoice-template), companies
app/api                   one folder per resource; every route uses withUser + assertCompanyAccess
components/               shell, sidebar, topbar, keyboard shortcuts, quick-create, item-search,
                          voucher-form, company/purchase forms, logo upload, ui/*
```

### Accounting model

Everything is double entry in `ledger_entries`; each line's `refId` ties it to its source.

| Event | Debit | Credit | `refId` |
|---|---|---|---|
| Sale (Tax Invoice) | Customer (total), Discount Allowed | Sales Account (gross), CGST/SGST/IGST Output, Round Off (±) | sale id |
| Purchase bill | Purchase Account, CGST/SGST/IGST Input | Supplier (total) | purchase id |
| Payment received | Cash/UPI/Bank/Cheque | Customer | payment id |
| Payment made | Supplier | Cash/UPI/Bank/Cheque | payment id |
| Debit / money in (manual) | Cash/UPI/Bank/Cheque | "Received from" head | voucher id |
| Credit / money out, expense | Expense head | Cash/UPI/Bank/Cheque | voucher id |
| Contra (type CONTRA) | *To* account (Cash/UPI/Bank/Cheque) | *From* account | voucher id |

- **Rojmel** lists only the cash/bank lines: debit = money in, credit = money out.
- **One payment path:** `addPayment()` writes the payment and its two ledger lines, then recomputes the document's `amountPaid` and status from all its payments. Changing "amount paid" books the difference as a correcting payment.
- **Balances are computed, not stored:** customer outstanding = Σ(total − paid) of Tax Invoices.
- Quotations, proformas, POs and challans never touch GST, the ledger or outstanding; draft purchases post when approved.

### GST rules

- State code = GSTIN prefix, or the state set on the company / customer.
- Same state → CGST + SGST (half each); different state → IGST.
- Invoice-level discount is spread over the lines **before** tax (CGST Act s.15(3)(a)): ₹1,000 @18% less ₹100 → taxable ₹900, tax ₹162, total ₹1,062.
- Sales totals are rounded to the rupee; the difference is Round Off on the invoice and in the ledger. Purchase bills keep the supplier's paise.
- GSTR-1: registered buyers → B2B grouped by GSTIN; others → B2CS by place of supply and rate; `fp` is the month filed.

### Database

- SQLite via `node-sqlite3-wasm` (WebAssembly: the same `node_modules` works in Node and Electron, no native rebuild). WAL mode, foreign keys on.
- **Migrations:** append `{ version, sql }` to `MIGRATIONS` in `lib/db/schema.js`; never edit a shipped one. Each runs in its own transaction and rolls back on error; a snapshot is taken first.
- **Transactions:** multi-table writes run in `transaction()`; only await DB calls inside it.
- **Placeholders:** `$1, $2…` become SQLite `?1, ?2…`, so reusing `$1` binds the same value.
- `findWhere` / `findOne` take an object filter (indexed `WHERE`); column names are checked against `SCHEMAS`.

### Security

- One owner account; signup closes once a user exists. Password reset needs the recovery code (bcrypt-hashed).
- The session secret is sealed with Electron `safeStorage` (Windows DPAPI); the Gemini key is AES-256-GCM encrypted with a key derived from it.
- Every API route verifies the session and company ownership server-side; `middleware.js` only redirects.
- The app listens on `127.0.0.1` only. The window loads only the local server; the server reaches only localhost and Gemini.
- The books file itself is not encrypted: protect the Windows account.

---

## 6. Developer setup

```bash
npm install
cp .env.example .env.local     # set JWT_SECRET (command below)
npm run dev                    # http://localhost:3000
npm run dev:app                # second terminal: desktop window on the dev server (hot reload)
npm run check                  # self-check
```

Secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

`.env.local` (development only; the packaged app needs none):

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Signs the login cookie. Required in dev. |
| `SESSION_COOKIE_NAME` | Optional, default `bb_session`. |
| `BILLBHARAT_DATA_DIR`, `BILLBHARAT_BACKUP_DIR` | Optional data / backup folders. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional dev fallback; normally the key is entered in Settings. Default model `gemini-2.5-flash`. |
| `DEV_BYPASS_AUTH=1` | Skips login with a dummy admin. **Never ship.** |

Building the `.exe` is described in [README.md](README.md#build-the-windows-exe).

---

## 7. Changing the code safely

- **New table / column:** add a migration, add the columns to `SCHEMAS` (`lib/db.js`) and to the zod schema in `lib/validations.js` (zod drops unknown fields), JSON columns to `JSONB_COLUMNS`.
- **New API route:** wrap in `withUser`, call `assertCompanyAccess`, use `transaction()` when writing more than one row.
- **Money logic:** go through `lib/accounting.js`; never write `amountPaid` or ledger lines by hand.
- **Invoice layout:** `generateInvoicePdf` in `lib/pdf.js`; new switches or labels go in `DEFAULT_TEMPLATE` and `TEMPLATE_SECTIONS` (`lib/invoice-template.js`) and appear in the editor automatically.
- **Dates:** use `localDate()`, never `toISOString().slice(0, 10)` (UTC: wrong before 05:30 IST).
- **Never add `{"type":"module"}`** to the project or `lib/`; it breaks `jspdf-autotable` in production builds only.
- Run `npm run check` and `npm run build` before shipping.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `JWT_SECRET not set` | Dev only: set it in `.env.local`. |
| Build fails with `Cannot find module './vendor-chunks/…'` or `./1682.js`, or hangs | A server or terminal still holds `.next` (Windows file locks). Close stray `node.exe` / `BillBharat.exe` and any terminal inside `.next`, delete `.next`, rebuild. |
| `Refusing to package: .env …` | Expected guard: secrets were about to ship. Rerun `npm run build`. |
| `SQLite wasm binary missing` | Check `outputFileTracingIncludes` in `next.config.js`. |
| Portable exe silent for ~30 s | It self-extracts first; use the installer for daily use. |
| PDF preview is a grey box (invoice template, AI upload) | Fixed in this version: the network lock-down in `electron/main.js` was blocking Chromium's built-in PDF viewer (`chrome://` pages). Rebuild with `npm run dist`. |
| SmartScreen warning | The build is unsigned: "More info" → "Run anyway". |
| Logo not on the invoice | Re-upload it (Settings → Company details or Invoice template); it is converted to PNG. Check the template's *Logo* tick. |
| Bank details blank on the invoice | Fill bank, branch, A/C no. and IFSC in Settings → Company details. |
| AI reader says "off" / "no internet" | Add the key in Settings, or enter the bill by hand. |
| Lists empty | No company selected (top bar). |
| `database is locked` | Another copy is running; close it. |
| `Migration N failed and was rolled back` | Books unchanged; a snapshot is in the backups folder. |
| Yellow bar "Last backup copy failed" | The extra folder was unreachable (pen drive out, Drive not running, share offline). Fix it and click *Back up now*. |
| App feels slow or stuck | Use the installed app or `npm run build && npm start`. `npm run dev` compiles each screen on first visit and is many times slower. Measured on the built app with 1,500 invoices and 3,000 items: saving an invoice and opening it takes about 0.1 s, and typing in a 25-row bill has no pauses. If it hangs while billing, check the yellow backup bar: an unreachable backup folder used to block saving and now no longer does. |
| `npm run dev` shows `ENOENT … .next\server\…page.js` | A production build (`npm run build` / `dist`) was left in `.next`. `npm run dev` now clears it by itself (the `predev` script). If it happens anyway: stop dev with `Ctrl+C`, delete the `.next` folder, start again. |

## 9. Not built yet

Encryption of the books file (needs a native SQLCipher driver), FIFO / weighted-average stock valuation, B2CL / credit notes in GSTR-1, per-invoice reverse charge (one Yes/No in the template), a second description line under item names. Projects (BOQ) and manual journals were removed; the database keeps their old tables and any old journal lines in the ledger so older books still open, and invoices that were billed to a site still print "Site: …".
