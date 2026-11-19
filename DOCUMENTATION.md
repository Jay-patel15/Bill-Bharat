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
10. [Changes in this version](#10-changes-in-this-version)

---

## 1. Using the app

### First run

1. **Sign up.** One owner account per install. **Write down the recovery code** shown once: it is the only way to reset the password. To get a new one later, use **Settings → Recovery code → Make new recovery code**; the old code stops working.
2. **Create your company:** name, GSTIN (its first two digits set your state, which decides CGST+SGST or IGST), PAN, address, phone, bank details, terms. A business that is not registered for GST leaves the GSTIN blank; its invoices then print without GST (no CGST/SGST/IGST, HSN or GSTIN lines).
3. Add customers and items (or create them on the fly with `Alt+C` while billing).
4. Make your first invoice: Sales → New invoice (or `F8`).

**Forgot password:** Login → *Forgot password?* → email + recovery code + new password.

### Daily work

| Task | Where |
|---|---|
| Sales invoice, quotation, proforma, PO, delivery challan | Sales → New (`F8`). Pick the document type at the top. The number is filled in automatically from the company's *invoice number format* (default `INV/26-27/0042`: one series per Indian financial year, April to March, restarting at 0001 on 1 April); the top line shows the previous number issued for that type. The format and layout are changed only in Settings → Invoice template, not while billing. Item names wrap so long names stay fully visible. Typing an item name in the last row opens a blank row below it. Each row has ↑ and ↓ buttons that insert a row above or below it. Rows without an item name are not saved. The summary and the *Save* button are at the bottom, after the items (`Alt+A` also saves). |
| Money received against an invoice | Open the invoice → *Record payment*. If the amount is more than what is pending, a warning appears: *Re-edit amount* or *Ignore and record anyway*. The *Payment History* under the box has **Edit** and **Delete** on each payment (see *Changing a payment*). |
| Print an invoice | Open the invoice → **Print**, or press `Ctrl+P` on the invoice page. The invoice goes straight to the printer; there is no separate PDF step. |
| Purchase bill | Purchases → New (`F9`), or *AI Purchase Reader* to fill it from a PDF/photo. Stock goes up. |
| Paying a supplier | Purchases → the bill → *Record payment*. The bill's *Payment History* has **Edit** and **Delete** on each payment. Supplier bills list has *Pay Bill* on every bill. |
| Payments from a customer | Customers → the customer → *Payments received*. **Edit** opens that invoice with the payment loaded into its *Record payment* box; **Delete** removes it. |
| Who owes you / whom you owe | Reports → Outstanding → *Customers* or *Suppliers* → *Download PDF*. |
| One party's full account | Reports → Party ledger → pick the party → detailed ledger (every bill and payment, running balance). Tick one or more invoices to limit it to those; *All* shows every invoice → *PDF* prints the same view. |
| GST figures and GSTR-1 JSON | Reports → GST. |

**Deleting a sale or purchase** puts the stock back and removes its payments and ledger entries.

### Changing a payment

- **Edit** on a payment in *Payment History* loads it into the *Record payment* box: amount, payment method and notes. Change them and press **Save Payment Changes**; *Cancel edit* leaves it as it was. The amount cannot take the document above its total.
- A payment with a Transaction ID (UPI, cheque, NEFT, RTGS) keeps its note; edit the note in the **Notes** field.
- **Delete** removes the payment. The paid amount, status and ledger are updated.
- The same Edit and Delete buttons are on the customer's *Payments received* list and the supplier bill's *Payment History*.

### Back button and number fields

- **Back** (top bar) returns to the page you opened from. The app remembers the pages you visit in this session. A page you replaced after saving (for example the invoice form after *Save*) is not kept, so Back does not return to it. On a supplier's bills, Back first closes the bills and returns to the supplier list. With nothing to go back to it opens the dashboard. `Esc` does the same when no dialog is open.
- Click into a number field and the number is selected, so typing replaces it (a `0` no longer stays in front).

### Electrical Works and consumables

Use this for electrical contracts where you bill one lump sum but the cable, pipe and breakers come out of stock.

1. **Turn it on once:** Inventory → *Enable Electrical Works consumables*. This adds one item called **Electrical Works**. It is not listed in the stock list or the stock report. *Disable Electrical Works consumables* hides it from new invoices; invoices already saved keep their lines.
2. **Bill it:** on a Tax Invoice, pick **Electrical Works** and type the lump-sum amount as the rate, as you would for any line. A popup opens for the parts used. Pick each part from stock and enter its quantity (for example 6 sq mm wire, 20 m), then *Done*. The line shows *Consumables: N part(s) · edit*.
3. **Stock:** when the invoice is saved, each part leaves stock. Deleting the invoice puts them back. The Electrical Works line itself moves no stock.
4. **Print:** the parts are **not printed**. The customer sees only the Electrical Works line with its amount.
5. **Only Tax Invoices** take parts. Delivery challans, quotations and proformas have no parts popup.
6. **Negative stock** is allowed. The popup warns *stock will go negative*, and the inventory list shows a red **Negative** badge (the stock report marks it *NEGATIVE STOCK*).

### Editing an invoice

1. Open the invoice → **Edit**. Change items, quantities, rates, discount, dates, notes or transport details, then save.
2. Stock and the ledger are reversed and posted again automatically. The customer and the invoice number stay the same.
3. **Only unpaid invoices can be edited.** As soon as money is recorded against an invoice, the Edit button goes and the server refuses edits. To change a paid invoice's items, delete its payments first (on the invoice page), then edit. The amount, method and note of a payment can be changed without deleting it (see *Changing a payment*).
4. Delivery challans can be edited the same way; they take no payments.

### Sending an invoice

On the invoice page:

- **WhatsApp** opens a chat with the customer's mobile. **Email** opens a mail draft to the customer's address.
- Both send the PDF with this message, filled in for the invoice:

  > Dear *customer*, your invoice generated on 27-Feb-23, Invoice No 1462/22-23, Amount 9,086.00 Dr, *company name*, Regards.

- **In a browser or on a phone** with a share sheet, the PDF is attached directly: pick WhatsApp, Gmail or any app.
- **In the desktop app** (BillBharat.exe) the PDF is saved to your **Downloads** folder, and WhatsApp (or your mail app) opens with the message. Attach the downloaded PDF to that message. Windows cannot attach a file to a WhatsApp link by itself.
- A 10-digit Indian mobile number gets `91` added for WhatsApp.

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
| **Updates** | *Check for updates* (desktop app only) looks for a newer BillBharat on GitHub. If one exists, it asks you to confirm, downloads it, installs it silently and restarts. The books are not changed; the server backs them up before the new version runs. This is the only time the app contacts the internet, and only when you press the button. The portable exe cannot update itself. |
| **Reset (erase all books)** | *Reset all books…* asks for your **login password**, then deletes every company with its customers, items, invoices, purchases, payments, ledger, audit log, invoice templates, logo and uploaded bills. Kept: your login, the AI key and backup folders. A full backup `before_reset_<time>.db` is saved first, so *Restore from file…* undoes it. A wrong password erases nothing. |
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
services/ai/gemini_service.js   internet-using code: key vault + bill OCR (AI reader)
electron/main.js registerUpdater  update check and install from GitHub (electron-updater), only on the Settings button; preload.js exposes it to the page
lib/
  db/sqlite.js            connection, pragmas, migration runner, snapshot/restore, transaction()
  db/schema.js            versioned migrations (tracked in _schema_migrations)
  db.js                   row store (insert/update/remove/find*), access checks, customerDues
  accounting.js           ledger postings: sales, purchases, payments (addPayment)
  sales.js                sale totals (priceSale) and editing an unpaid invoice (editSale)
  consumables.js          Electrical Works parts: checks, and stock moves on sale, edit and delete
  gst.js                  GST engine, amount in words
  gst-export.js           GSTR-1 JSON
  outstanding.js          outstanding statement and party ledger
  invoice-template.js     invoice print template: defaults, editor sections, sanitizing
  pdf.js                  invoice, outstanding and party statement PDFs
  auth.js, api.js         session cookie, response helpers
  utils.js                dates (localDate), money format, document types, payment modes, fuzzy search
app/(auth)                login, signup, reset (recovery code)
app/(app)                 dashboard, customers, inventory, sales, purchase, reports/*,
                          settings (+ company, invoice-template), companies
app/api                   one folder per resource; every route uses withUser + assertCompanyAccess
components/               shell, sidebar, topbar, keyboard shortcuts, quick-create, item-search,
                          company/purchase forms, logo upload, ui/*
```

### Accounting model

Everything is double entry in `ledger_entries`; each line's `refId` ties it to its source.

| Event | Debit | Credit | `refId` |
|---|---|---|---|
| Sale (Tax Invoice) | Customer (total), Discount Allowed | Sales Account (gross), CGST/SGST/IGST Output, Round Off (±) | sale id |
| Purchase bill | Purchase Account, CGST/SGST/IGST Input | Supplier (total) | purchase id |
| Payment received | Cash/UPI/Bank/Cheque | Customer | payment id |
| Payment made | Supplier | Cash/UPI/Bank/Cheque | payment id |

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
| Desktop icon, taskbar or Start menu still shows the Electron icon | Rebuild with `npm run dist`: `scripts/set-exe-icon.cjs` writes `build/icon.ico` into the program after packing (look for `icon set on BillBharat.exe` in the build output). Uninstall the old version, install the new one. Windows caches icons: pin again or restart Explorer if the old one stays. |
| WhatsApp or Email button in the desktop app looks stuck | The desktop app saves the PDF to Downloads and opens WhatsApp or your mail app; it does not use the system share sheet. Attach the saved PDF and close the window when done. |
| *Edit* is missing on an invoice | The invoice has payments. Its items can be changed only before payments are recorded. Payments themselves can still be edited or deleted in *Payment History*. |
| "Unknown column updatedAt for payments" when editing a payment | Fixed in this version: payments have no `updatedAt` column, and the shared update helper (`lib/db.js`) now writes it only for tables that have it. Update the app. |
| *Consumables can only be recorded on the Electrical Works line* | Parts were attached to a line that is not Electrical Works. Pick the Electrical Works item from the list, then add the parts again. |
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

The Daily Book (cash book), the expense manager, the manual cash vouchers and the repair for missing entries were removed; there is no screen for them in this version. Importing data from Excel or other billing software is not built. Encryption of the books file (needs a native SQLCipher driver), FIFO / weighted-average stock valuation, B2CL / credit notes in GSTR-1, per-invoice reverse charge (one Yes/No in the template), a second description line under item names. Projects (BOQ) and manual journals were removed; the database keeps their old tables and any old journal lines in the ledger so older books still open, and invoices that were billed to a site still print "Site: …".

---

## 10. Changes in this version

**Added**

- **Electrical Works consumables:** Inventory toggle; on a Tax Invoice, a popup takes the parts used from stock; parts are not printed (see *Electrical Works and consumables*).
- **Negative stock:** a red *Negative* badge in the inventory list, and *NEGATIVE STOCK* in the stock report.
- **Edit an unpaid invoice:** the *Edit* button reopens the invoice form; stock and ledger are reposted (see *Editing an invoice*).
- **Send an invoice:** WhatsApp and Email buttons send the PDF with a ready message; the desktop app downloads the PDF and opens the chat or mail draft (see *Sending an invoice*).
- **Overpayment warning:** an amount above the pending balance on an invoice, a supplier bill, or above the bill total on the invoice form, shows the same amber box: *Re-edit amount* or *Ignore and record anyway*. *Record* stays disabled until you choose. An ignored excess is stored as paid; it is not kept as a credit.
- **Back button:** top bar, next to the company name. It returns to the page you opened from (see *Back button and number fields*).
- **One Back button only:** the top bar. The in-page back arrows on customer, supplier and settings screens were removed.
- **Number fields select on focus:** a `0` (or any number) is selected when you click into it, so typing replaces it.
- **NEFT and RTGS payments** post to the *Bank Transfer* ledger (before they went to *Cash/Bank*).
- **Program icon:** the BillBharat bill is on the program file, installer, uninstaller and desktop shortcut; the app sets its own Windows app identity so the taskbar shows the same icon.
- **Edit and delete payments:** each payment in *Payment History* (invoice, supplier bill) and *Payments received* (customer) has **Edit** and **Delete**. Edit loads the payment into the *Record payment* box to change its amount, method and note (see *Changing a payment*).
- **Print button:** the invoice's **PDF** button is now **Print**, and `Ctrl+P` on the invoice page prints it directly. In the desktop app, *File → Print…* does the same on the invoice page and prints the screen everywhere else.
- **Item rows:** typing an item name in the last row opens a blank row below it; each row has ↑ and ↓ to insert a row above or below. The separate *Add row* button is gone.
- **Recovery code in Settings:** *Settings → Recovery code → Make new recovery code* shows a new code once and retires the old one.
- **Non-GST invoices:** leave the company's GSTIN blank and invoices print without GST.
- **Check for updates:** Settings → *Updates* (desktop app only). Downloads and installs the newer version from the public GitHub repo after you confirm. Developers publish with `npm run release` (see README, *Publishing a new version*).

**Changed**

- Stock on a sale ignores the Electrical Works line itself; only its parts move stock. Deleting or editing a sale reverses them.
- Turning Electrical Works off hides it from new invoices but keeps the item, so invoices already saved stay editable.
- Parts are allowed only on Tax Invoices.
- WhatsApp numbers with 10 digits get `91` added.
- The desktop app never uses the system share sheet for sending (it could stay open with no way to finish).
- **Supplier payments:** recording a payment with an empty or zero amount shows the same *Invalid amount* message as customers.
- **Error messages** on supplier (purchase), settings and company screens are now the same toast popup used by customers, instead of the browser's native alert box.
- The Electrical Works item is written into the program file after packing (`scripts/set-exe-icon.cjs`), not by electron-builder's icon step.
- **Payment history** on the invoice, supplier bill and customer screens: the *Edit total paid amount* option (invoice) and *Edit paid amount* option (supplier bill) are removed. Use **Edit** on the payment instead.
- **Pay Bill** button in the supplier bills table is centered and padded inside its cell.
- **Small buttons** (`size="xs"`) get proper padding and height; they were unstyled before.
- **Payment edits** no longer fail with "Unknown column updatedAt for payments".

**Removed**

- **Daily Book** (cash book, formerly "Rojmel") and its keys: the page, `/api/reports/daybook`, and `F4`, `F5`, `F6`.
- **Expenses** page and `/api/expenses`, with its expense heads.
- **Manual cash vouchers** (receipt, payment and contra entries) and their API.
- **"Add missing invoice and payment entries"** repair.
- The **Projects / job** feature added during development was removed completely.
- The invoice form's **Add row** button (replaced by row-level ↑ ↓ and the automatic blank row). The purchase form still has its own *Add row* button.

Old cash and expense lines already in a database stay there and still count in the ledger and reports. Nothing in this version can add or remove them.

**Not built:** importing data from Excel or other billing software, opening-balance entry for cash, bank and party dues. Use the *Not built yet* list below for the rest.
