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
| Paying a supplier | Purchases → the supplier → the bill → *Record payment*. The bill's *Payment History* has **Edit** and **Delete** on each payment. Each row of the supplier's *Supplier Bills* list has *Pay Bill* for that bill. |
| Supplier summary for one bill | Purchases → the supplier → **Show** (dropdown above the figures). *All bills combined* shows the totals of every bill. Choose a bill to show only its *Total Billed*, *Amount Paid* and *Pending Balance*. |
| Payments from a customer | Customers → the customer → *Payments received*. **Edit** opens that invoice with the payment loaded into its *Record payment* box; **Delete** removes it. |
| Who owes you / whom you owe | Reports → Outstanding → *Customers* or *Suppliers* → *Download PDF*. |
| Install a newer BillBharat | Settings → Updates → *Check for updates* (desktop app only). See *Settings → Updates* in section 2. |
| One party's full account | Reports → Party ledger → pick the party → detailed ledger (every bill and payment, running balance). Tick one or more invoices to limit it to those; *All* shows every invoice. The PDF buttons depend on how many bills are included (see *Party ledger PDF* below). |
| GST figures and GSTR-1 JSON | Reports → GST. |

**Deleting a sale or purchase** puts the stock back and removes its payments and ledger entries.

### Party ledger PDF

Reports → Party ledger. Choose the party, then the bills to include: *All*, or tick some of them.

- **One bill** (one invoice, or one ticked bill): a single **PDF** button. The PDF has that bill's lines with opening and closing balance.
- **Several bills** (*All*, or two or more ticked): two buttons. Pick the layout:
  - **PDF: combined table**: one table with every bill's lines in date order, and one running balance. Use this for a single statement of the account.
  - **PDF: table per bill**: one PDF with a heading for each bill (*Invoice* or *Bill* number, date, amount), then that bill's own table: its opening balance, its lines, and its closing balance. A totals line and the amount receivable (or payable) come at the end. Use this to check each bill separately.
- Both PDFs use the same figures. The per-bill tables add up to the combined totals.
- The on-screen table is always the combined table.
- Date range (*From* / *To*) applies to both layouts. Bills dated before *From* carry their balance forward as the opening balance.

### Receiving or paying a lump sum

Use this when one amount settles several bills of the same customer or supplier.

- **Customer:** open the customer and press **Receive lump sum**. **Supplier:** under **Purchases**, open the supplier and press **Pay lump sum**.
- Type the amount and choose the payment method. A table shows the split **before** you save: each bill, what it still owes, what this amount takes from it, and whether it is *Cleared*.
- The amount goes to the **oldest bill first** (bill date, then bill number), then to the next, until it runs out. Bills with nothing owed are skipped.
- For customers only **Tax Invoices** count (quotations, proformas and challans do not). For suppliers, **draft** bills are skipped.
- An amount **above the total still owed is refused**. Nothing is recorded; the dialog says so and the button stays disabled.
- Each bill that receives money gets **its own payment row**, noted *Part of lump sum of ₹…* and dated today. These rows appear in each bill's Payment History, the customer's *Payments received* list, the supplier passbook and the party ledger, and each bill's status updates.
- The whole lump sum is saved in one step. If any part fails, nothing is saved.
- There is no date or reference-number field yet: the payment date is today.

### Print preview and saving PDFs

- **Print / Save PDF** on an invoice (and on the invoice rows in *Sales / Invoices* and on a customer's page) opens a **print preview** instead of printing at once. Ctrl+P and the desktop app's *File → Print* open the same preview.
- The party ledger PDF and the outstanding statement PDF open the same preview.
- In the preview:
  - **Print** sends the document to the printer.
  - **Save as…** lets you choose the folder and file name. In the desktop app this is the Windows Save As dialog. In Chrome or Edge it is the browser's save picker. Other browsers use their normal download, which goes to their download folder unless they are set to ask.
  - **Close** (or Esc) leaves without printing or saving.
- The old **Save PDF** button, which kept a copy inside the app's data folder without asking where, has been removed. Use **Save as…** to keep a copy.

### Changing a payment

- **Edit** on a payment in *Payment History* loads it into the *Record Payment* box: amount, payment method and notes. Change them and press **Save Payment Changes**; *Cancel edit* leaves it as it was.
- An edit **replaces that payment's amount in place**. No new payment is added, and the party ledger shows the payment as a normal receipt (*Received by …*), not as a correction.
- A payment with a Transaction ID (UPI, cheque, NEFT, RTGS) keeps its note; edit the note in the **Notes** field.
- **Delete** removes the payment. The paid amount, status and ledger are updated.
- The same Edit and Delete buttons are on the customer's *Payments received* list (Edit opens the invoice with that payment loaded) and on a supplier bill's *Payment History*.
- The sales invoice and the purchase bill use the **same payment screen**: three figures (Total, Received, Pending), the Record Payment form, and Payment History.
- **Arithmetic** (`lib/payments.js`, used by the screens and checked again by the server):
  - Received = the sum of the document's payment rows.
  - Pending = Total − Received, never below zero.
  - While one payment is being edited, the room left = Total − the other rows, so its own old amount is not counted.
  - A payment or edit above the room is refused by the server, unless the user chose **Ignore and record anyway**.
- **Old correction rows:** before this version, changing a bill's paid amount wrote a negative *Correction* row. Those rows still show as *Correction* in the party ledger. Nothing writes new correction rows now.
- If the payment being edited is deleted, or disappears after a refresh, edit mode is cancelled with a message. The save never falls back to recording a new payment.

### Stock and the low-stock warning

- Each sale takes stock out, each purchase puts stock in, and deleting or editing a sale or purchase reverses its stock. Electrical Works parts count as stock used (see *Electrical Works and consumables*).
- **Low-stock warning:** each item has a **Low stock threshold** (Inventory → the item → *Low stock threshold*). The warning shows when stock is **at or below** the item's alert level.
  - The alert level is the item's own threshold. An item whose threshold is **0** uses the company default set in **Settings → Low stock alert**.
  - The default starts at 0, which means no alert for those items.
  - Equal counts as low: threshold 5, stock 5 → low.
  - Threshold 0 on the item means *use the company default*. If the company default is also 0, no warning shows.
  - Negative stock with a threshold above 0 also counts as low.
- The warning appears in the **Low stock** card on the dashboard (up to 10 items) and as the low-stock flag on the inventory list. It is worked out when those screens load, not when you save.
- The stock report (Excel) shows *LOW STOCK*, or *NEGATIVE STOCK* for negative quantities, in its status column.

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
- **WhatsApp in the desktop app** (BillBharat.exe): WhatsApp cannot take a file from a link, so the app does this instead: it saves the PDF to `Downloads\BillBharat\<invoice number>.pdf`, copies that file to the Windows clipboard, opens the WhatsApp chat with the message filled in, and opens the folder with the PDF selected. In the chat press **Ctrl+V** to paste the PDF, then send. If it does not paste, drag the highlighted file from the folder into the chat. The toast tells you which of the two happened (*PDF copied* or *PDF saved*). Pasting depends on the WhatsApp app or web page accepting a pasted file, so check it once on your PC.
- **Email in the desktop app** still saves the PDF to **Downloads** and opens a mail draft; attach the saved PDF to it.
- A 10-digit Indian mobile number gets `91` added for WhatsApp.

### Quotations

A quotation (QT prefix) is a price offer. It changes no stock, no ledger, no customer balance, and no GST or sales total, and it takes no payment.

- **Create:** pick *Quotation* in the pill bar on the invoice form. Its *Valid till* date appears in the Dates card; it prints as the note *This quotation is valid till DD/MM/YYYY.*
- **Status:** *Draft*, *Sent* or *Accepted*, set from the dropdown on the quotation page. Those three are the only ones you choose. *Converted* is set when the quotation becomes an invoice.
- **Edit:** change the items, rates or dates any time until it is converted; the number stays.
- **Convert to invoice:** opens a new Tax Invoice filled from the quotation, with a new INV number and today's date. Saving it marks the quotation *Converted* and links the two (*Open invoice* on the quotation). A converted quotation cannot be edited; edit the invoice instead. Deleting that invoice reopens the quotation as *Accepted*.
- **Preview and print:** *Print / Save PDF* on the quotation page, or *Preview quotation* on the form before saving. The preview saves nothing.
- **Style:** Settings → Invoice templates → *Quotation template* has its own layout and the *Quotation note* (default: *Prices are subject to change with market prices.*), printed on every quotation.
- **Sending:** WhatsApp and email say *quotation* and *Quotation No*.

### Deleting a document

On an invoice, quotation or delivery challan page, **Delete** removes it. The confirm box says how many payments on it will be removed too (their total shown). Stock is put back, the ledger lines for it are removed, and a quotation that became this invoice reopens as *Accepted*. This cannot be undone; take a backup first if in doubt.

### Importing from CSV

- **Products:** *Inventory → Import CSV*. Columns: `name` (required), `sku`, `barcode`, `category`, `hsnCode`, `unit`, `purchasePrice`, `sellingPrice`, `gstRate`, `quantity`, `lowStockThreshold`. Column names are not case-sensitive and spaces are ignored (`HSN Code` works). Items with a name or SKU already in the books, repeated lines, or bad numbers are skipped and listed with their line numbers. Up to 5,000 rows.
- **Names only:** Settings → *Product master names* → *Import names from CSV*. The column headed `name`, `product` or `item`, otherwise the first column.
- Excel-saved CSV files work, including leading zeros in codes (`0123`).

### The invoice PDF

The standard industrial GST tax invoice (A4, bordered):

- **Header:** logo top-left, company name, tagline lines ("Auth.Dist.: …", "MFGRS.OF …"), REGD.OFF. address, Tel / E-Mail.
- **ID strip:** GSTIN / PAN / STATE · TAX INVOICE with the Rule 46 notice and Tax Reverse (N/Y) · Original / Duplicate / Triplicate.
- **Dispatch:** Invoice, Challan and Order numbers and dates (left); LR, Transporter, E-way, Payment and Due on (right). Filled from *Transport & Consignee Details → Add dispatch / consignee details* on the invoice form.
- **Parties:** Receiver/Buyer and Consignee/Ship To with place of supply and GSTIN.
- **Items:** Sr, description, HSN, quantity, rate, unit, disc%, amount, with ruled columns down the page. Total quantity, sub total, discount, CGST/SGST/IGST by rate and round off sit inside the grid.
- **Notes:** the Notes from the form print above the amount in words. On a quotation the valid-till sentence and the quotation note print first.
- **Footer:** amount in words + grand total; bank details + declaration; *TERMS AND CONDITIONS* as bullets, Receiver's Sign., For company / Auth.Sign.

Dates print as dd/mm/yyyy. **Long bills continue automatically:** each full page ends with "Continued on next page…", the column headings repeat, and totals and footer print once on the last page.

---

## 2. Settings

| Section | What you can change |
|---|---|
| **Company details** | Company name, GSTIN, PAN, phone, email, logo, address, city, pincode, state, **bank name, branch, account number, IFSC**, terms. Saved changes apply to every invoice printed afterwards. *All companies* lists, adds and switches companies. |
| **Invoice templates** | Two layouts: *Tax invoice template* and *Quotation template*, chosen with the switch at the top of the editor (each keeps its own changes, and unsaved changes ask before a switch). The quotation editor also has the *Quotation note* (default: *Prices are subject to change with market prices.*). *Invoice number format* (see below). Turn each part of the invoice on or off and rename its label; upload the logo; tagline lines; declaration; terms; reverse charge Yes/No. Live A4 preview on the right; tick *Preview a long bill* to see page 2. *Reset to default* restores the standard layout. Saved per company. |
| **Low stock alert** | The company's default low-stock level, in units. An item with no threshold of its own uses it; an item's own threshold always wins. `0` (the starting value) turns the default off. The page shows the current value; negative numbers are refused. |
| **Terms & Conditions** | One term per line; printed as bullets under a *TERMS AND CONDITIONS* heading at the foot of every invoice and quotation. Same text as in Company details and the template editor. |
| **Backup & Restore** | *Extra backup folders*: up to 5 folders (one per line) that get a copy of every backup; *Save folders* tests that each can be written and makes a first copy. *Back up now* backs up to the backups folder and every extra folder. *Download a copy* saves one `.db` file wherever you choose. *Restore from file…* checks the file and saves the current books before replacing them. See [Keeping backups safe](#keeping-backups-safe-windows-crash-or-drive-reset). |
| **Updates** | *Check for updates* (desktop app only; a browser shows a note instead of the button). It asks GitHub for the newest published release. If that release is newer than this version, it asks you to confirm, downloads the installer, installs it silently and restarts BillBharat. Your books are not changed: the server copies them to the backups folder first when a new version starts. This is the only time the app contacts the internet for updates. The portable exe cannot update itself. How releases are published: section 6, *Releasing an update*. |
| **Reset (erase all books)** | *Reset all books…* asks for your **login password**, then deletes every company with its customers, items, invoices, purchases, payments, ledger, audit log, invoice templates, logo and uploaded bills. Kept: your login, the AI key and backup folders. A full backup `before_reset_<time>.db` is saved first, so *Restore from file…* undoes it. A wrong password erases nothing. |
| **Gemini AI bill reader** | Optional. Paste a key from aistudio.google.com/app/apikey to let the AI read purchase bills. Stored encrypted on this PC. Without it, everything works by hand. |
| **Product master names** | Names the AI reader maps supplier wording onto. Type one per line, or *Import names from CSV*: the column headed `name` (or `product`, `item`), else the first column. Names already listed, and names repeated in the file, are skipped and counted. |

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
| `F7` | **New customer**: opens the Customers page with the new-customer form open. |
| `F6` | **New item**: opens the Inventory page with the new-item form open. |
| `F4` | **AI purchase**: opens the AI purchase reader. |
| `Alt+A` | Accept (save) the current form or open dialog |
| `Alt+C` | Quick-create a customer, or an item when in an item grid |
| `F2` | Jump to the date field |
| `Enter` | Next field; on the last cell of the last item row moves to the blank row below it (that row is added as soon as the last row has an item name); on the last field of a form saves |
| `Ctrl+P` | On an invoice: print it directly (same as the **Print** button). Elsewhere in the desktop app: print the page. |
| Item search | Type part of a name, SKU, barcode or HSN (`tmt12` finds "TMT Bar 12mm"), `↑`/`↓`, `Enter`. A scanned barcode is picked at once. |
| `Esc` | Close the dialog, or go back |

`F8`, `F9`, `F7`, `F6` and `F4` leave the current screen at once: an unsaved form is lost, so save first. `Alt+A` and `Alt+C` act on the screen you are on. The legend is shown at the bottom of every screen.

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
electron/main.js registerPdfSave  Save As dialog for PDFs (IPC pdf:save); preload.js exposes it as window.billbharatDesktop.savePdf
lib/
  db/sqlite.js            connection, pragmas, migration runner, snapshot/restore, transaction()
  db/schema.js            versioned migrations (tracked in _schema_migrations)
  db.js                   row store (insert/update/remove/find*), access checks, customerDues
  accounting.js           ledger postings: sales, purchases, payments (addPayment)
  sales.js                sale totals (priceSale) and editing an unpaid invoice (editSale)
  consumables.js          Electrical Works parts: checks, and stock moves on sale, edit and delete
  whats-new.js            release notes for the update popup; decides when to show it (whatsNewState)
  payments.js             payment arithmetic (received, pending, room left) and the lump-sum split: allocateLumpSum, oldestFirst, supplierKey
  lump.js                 lump-sum payment: pays the oldest bills first in one transaction, one payment row per bill (through addPayment)
  stock.js                low-stock rule (own threshold, else the company default), shared by server and screens
  low-stock.js            server side of the low-stock default (reads the setting)
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
                          pdf-preview (print preview and Save as), lump-sum-dialog (lump-sum payment), app-shell with the phone menu drawer (sidebar, topbar), whats-new (thank-you popup after an update)
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

### Releasing an update

**How the update button works**

- `electron/main.js` → `registerUpdater()` uses `electron-updater`. `update:check` reads `latest.yml` from the newest GitHub release and reports an update only when its version is higher than the installed one. `update:install` downloads the installer, runs it silently and quits so the install can replace the app.
- `electron/preload.js` exposes those two calls to the page as `window.billbharatDesktop`. The Settings card shows the button only when that object exists, so a plain browser shows a note instead.
- The repo is public (`Jay-patel15/Bill-Bharat`), so the app reads releases without a token. The package.json `build.publish` block names the repo and sets `releaseType: "release"`. Drafts are not visible to the updater.
- Unpacked builds (`npm run dev:app`) report *Updates are checked in the installed app only* and never install.

**To publish version X.Y.Z**

1. Set `"version"` in `package.json` to `X.Y.Z`. It must be higher than the last published release.
2. Run `npm run check` and `npm run build`. Fix anything they report.
3. Commit and push the code, then tag it: `git tag -a vX.Y.Z -m "BillBharat X.Y.Z"` and `git push origin vX.Y.Z`. Do this before step 5, so the release points at this commit.
4. Create a GitHub token with permission to write releases to this repo. In PowerShell set it for the session only: `$env:GH_TOKEN = "<token>"`. Never write it into a file or commit it. `.env` and `.env.local` are git-ignored; keep it out of them too.
5. Run `npm run release`. It builds the app and uploads `BillBharat-X.Y.Z-x64.exe`, its `.blockmap` and `latest.yml` to a published release `vX.Y.Z`.
6. Check the release: `https://api.github.com/repos/Jay-patel15/Bill-Bharat/releases/latest` should show `tag_name` `vX.Y.Z`, `"draft": false`, and the three files. Then test: install the previous version on a copy of your data, press *Check for updates*, and confirm the books are still there and a `backup_v<old version>_*.db` appeared in the backups folder.

**Limits**

- Users on versions before 1.0.1 have no update button. They install the new installer once, by hand, over the old one. Their data stays.
- The portable exe is not published by `npm run release` and cannot update itself.
- The installer is not code-signed, so Windows SmartScreen may warn when it runs. A code-signing certificate removes the warning.
- The update check is the only outbound request the app makes on its own, and only when the button is pressed. The app window still loads only the local server. The updater uses its own network session, so the window's request filter does not block it.

---

## 7. Changing the code safely

- **New table / column:** add a migration, add the columns to `SCHEMAS` (`lib/db.js`) and to the zod schema in `lib/validations.js` (zod drops unknown fields), JSON columns to `JSONB_COLUMNS`.
- **New API route:** wrap in `withUser`, call `assertCompanyAccess`, use `transaction()` when writing more than one row.
- **Money logic:** go through `lib/accounting.js`; never write `amountPaid` or ledger lines by hand.
- **Invoice layout:** `generateInvoicePdf` in `lib/pdf.js`; new switches or labels go in `DEFAULT_TEMPLATE` and `TEMPLATE_SECTIONS` (`lib/invoice-template.js`) and appear in the editor automatically.
- **Dates:** use `localDate()`, never `toISOString().slice(0, 10)` (UTC: wrong before 05:30 IST).
- **Never add `{"type":"module"}`** to the project or `lib/`; it breaks `jspdf-autotable` in production builds only.
- Run `npm run check` and `npm run build` before shipping.
- **Every release needs a higher `version` in `package.json`.** The update check ignores a release that is not newer, and the pre-update backup is named after the old version.
- **Dependencies:** `electron-updater` is the only library added for updates. Do not add another updater without removing it.
- **A new dependency used by the desktop shell** (`electron/`) must also be listed in `build.files` in `package.json`, with its runtime dependencies. The installer excludes `node_modules` by default. Version 1.0.1 crashed on start because this was missing. After any change, build with `npm run dist:dir` and check that `dist/win-unpacked/resources/app/node_modules/<package>` exists.
- **Add the release notes.** For every release, add an entry to `WHATS_NEW` in `lib/whats-new.js` (a list of short sentences). The popup shows them after the update. A version without an entry shows a generic thank-you.
- **Run the self-checks** before a release (each prints a pass line or throws):
  `node scripts/test-payment-edit.mjs`, `node scripts/test-party-ledger-bills.mjs`, `node scripts/test-gst-payments.mjs`, `node scripts/test-sale-edit.mjs`, `node scripts/test-consumables.mjs`, `node scripts/test-back.mjs`, `node scripts/test-lump-sum.mjs`, `node scripts/test-low-stock.mjs`, `node scripts/test-whats-new.mjs`, `node scripts/test-quotation.mjs`, `node scripts/test-inventory-import.mjs`, `node scripts/test-invoice-pdf.mjs`, and `npm run check`.

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
| *Check for updates* is missing | The Updates card is in version 1.0.1 and later, and the button only works in the installed desktop app. In a browser (localhost) the card shows a note. Install 1.0.1 by hand once. |
| *Check for updates* says "Could not check for updates" | No internet, GitHub unreachable, or no published release. Open `https://github.com/Jay-patel15/Bill-Bharat/releases` to see the newest version. |
| *Update failed* after you confirmed | Antivirus or SmartScreen blocked the installer. Download the installer from the release page and run it by hand. Your books are kept. |
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

## 10. Changes

### Version 1.0.7

**Added**

- **Quotations** (QT): status *Draft / Sent / Accepted / Converted*, edit until converted, *Convert to invoice* (saved in one step with the quotation marked *Converted* and linked), *Open invoice*, *Valid till* printed as a note, *Preview quotation* before saving, its own template and note. Quotations take no stock, ledger, payment or sales total. Routes: `POST /api/sales/preview`; `convertFromId` on `POST /api/sales`; `?type=quotation` on `/api/settings/invoice-template`. Logic: `lib/sales.js` (`quoteStatusFor`, `checkQuoteStatus`, `quoteToConvert`, `markConverted`). Migration 5 adds `sales.convertedToId`.
- **Delete** on an invoice or quotation page; the confirm box counts the payments that go with it. Deleting an invoice made from a quotation reopens the quotation.
- **CSV import** of products (`POST /api/inventory/import`, `lib/inventory-import.js`) from *Inventory → Import CSV*, and of product names from *Settings → Product master names*. Skipped rows are listed with their line numbers.
- **Keyboard:** `F7` new customer, `F6` new item, `F4` AI purchase reader.
- **Invoice form:** *Preview* button; the document-type buttons stay visible and highlight the open type while editing.
- **Settings:** *Tax invoice template* and *Quotation template* buttons.
- **Self-checks:** `scripts/test-quotation.mjs`, `scripts/test-inventory-import.mjs`, `scripts/test-invoice-pdf.mjs`.

**Changed**

- The PDF prints the form's **Notes** (they were saved but never printed).
- **Terms & Conditions** print under a heading as bullets.
- Settings: the *Master list import* card was removed; the product import is on the Inventory page.
- Dialog footers wrap instead of running out of the box. The *Record Payment* and *Close bill* buttons sit on one line in the payment card, and the Payment Method box is narrower.
- Dashboard totals, the sales report and the sales export leave out quotations.

**Fixed**

- Excel-saved CSV files (with a hidden byte-order mark) and codes with leading zeros (`0123`) import correctly.
- The invoice API (`PUT /api/sales/[id]`) refuses a status change on a quotation that is already converted.
- Payments cannot be recorded against a quotation (`POST /api/sales/[id]/payments`).

**Note for maintainers**

- Known: a clean `next build` on Windows sometimes fails once with `Cannot find module for page: /api/...` during page-data collection; running the build again passes.
- Known: deleting a customer that has invoices still succeeds and leaves those invoices without a customer (see the QA list). Deleting a product in use is not blocked either.

### Version 1.0.6

**Added**

- **"Thanks for updating" popup.** After an update, the first start shows *Thanks for updating to BillBharat X.Y.Z!* with what the new version added. It shows once per version; *Got it*, Esc or a click outside all count as seen. Logic: `whatsNewState` and `isNewer` in `lib/whats-new.js` (self-check `scripts/test-whats-new.mjs`). Route: `GET/POST /api/app/whats-new`. The seen version is stored in the books (setting `whats_new_seen_version`), not in the browser, because the desktop app's port changes on every start. A new install with no companies is marked seen silently, so it is not greeted by the popup.

**Changed**

- **WhatsApp in the desktop app now carries the PDF.** Before, it saved the PDF to Downloads and opened WhatsApp with only the message. Now the PDF is also copied to the Windows clipboard as a file (paste with Ctrl+V in the chat) and its folder is opened so it can be dragged in. The Electron side is `registerPdfShare` in `electron/main.js` (IPC `pdf:share`), exposed to the page as `window.billbharatDesktop.sharePdf`. The copy uses PowerShell `Set-Clipboard -Path` with the path in an environment variable, so no path text reaches a command line. The clipboard copy is Windows-only.
- Phones and browsers with a share sheet are unchanged: the PDF is attached directly with the message.
- Email in the desktop app is unchanged.

**Note for maintainers**

- A packaged build must be made with `npm run build` (or `npm run dist:dir` / `npm run release`), not `next build` alone. `scripts/prepare-standalone.mjs` copies the static assets into the package; without it every `/_next` file returns 404 and the window shows unstyled pages with no company loaded.

### Version 1.0.5

**Added**

- **Lump-sum payments** on a customer (*Receive lump sum*) and on a supplier (*Pay lump sum*). One amount settles the oldest bills first, the split is shown before saving, each bill gets its own payment row, and an amount above what is owed is refused. See *Receiving or paying a lump sum*. Routes: `POST /api/customers/[id]/lump-payment` and `POST /api/purchases/lump-payment`. Logic: `lib/lump.js`, with `allocateLumpSum` and `oldestFirst` in `lib/payments.js`.
- **Print preview** for invoices, the party ledger PDF and the outstanding PDF, with **Print** and **Save as…** (`components/pdf-preview.jsx`). In the desktop app, Save as uses the Windows Save As dialog (IPC `pdf:save`, exposed as `window.billbharatDesktop.savePdf`).
- **Low stock alert default** in **Settings** (`GET/PUT /api/settings/low-stock`). Items whose own threshold is 0 use it. The rule is in `lib/stock.js` and is used by the dashboard, the inventory list, the inventory export and the item form.
- **Phone and small-tablet menu:** a menu button opens the navigation as a drawer. It closes on Escape, on the backdrop, and after a page is picked.
- **Supplier passbook from the party ledger:** one line per bill and per payment with a running balance, so a split payment shows each part.
- **Self-checks:** `scripts/test-lump-sum.mjs`, `scripts/test-low-stock.mjs`.

**Changed**

- **Save PDF button removed** from the invoice page. It kept a copy in the app's data folder without asking where. Use **Save as…** in the print preview.
- **Supplier grouping** ignores case and surrounding spaces, the same as the ledger and the outstanding report: "ABC Traders" and "abc traders " are one supplier. The supplier passbook hides draft bills, which are not payable yet.
- **Top bar:** labels shrink on small screens, the company list closes on Escape and on an outside click, and *New Invoice* is a single link (it was a button inside a link).
- **Sidebar** runs the full height of the window on desktop.

**Fixed (layout, found by a UI audit at 1440, 768 and 375 px)**

- The sidebar background stopped partway down the page.
- Phones had no navigation.
- Pages wider than a phone screen: sale detail totals and items, Settings cards, sales report summary tiles, finance tiles on tablets, the purchases header, and the action buttons on customer and sale pages.
- Buttons wrapping onto two lines (for example *New invoice* and *Print / Save PDF*).
- The keyboard-shortcut bar covering content on phones (now shown from the desktop width up).
- Inventory and sales tables: HSN, Unit, Subtotal and Tax columns hide below the tablet width so the name column stays readable.
- Dashboard low-stock numbers (`≤ 5`) wrapped onto three lines.

**Not changed in this release**

- There is still no dark theme. The app only defines light colours.
- The update button still only works in the installed desktop app; the portable exe cannot update itself.

### Version 1.0.4

**Added**

- **Supplier summary by bill:** the *Record Payment / Pay Bill* button on the supplier page is removed. A **Show** dropdown above the three figures chooses *All bills combined* or one bill. Total Billed, Amount Paid and Pending Balance follow the choice; the selected bill's row is highlighted in the table.
- **Party ledger PDF, one table per bill:** when several bills are included, the Party ledger offers *PDF: combined table* or *PDF: table per bill* (a separate table with its own heading for each bill, in one PDF). The per-bill tables add up to the combined totals. See *Party ledger PDF*.
- **Self-check:** `scripts/test-party-ledger-bills.mjs`.

### Version 1.0.3

**Added**

- **Payments on purchase bills** use the same screen as sales invoices: Total, Received and Pending figures, the Record Payment form, **Close bill**, and Payment History with **Edit** and **Delete** (`components/payment-section.jsx`).
- **Payment arithmetic in one place** (`lib/payments.js`), used by the screens and checked by the server. See *Changing a payment*.
- **Server checks on payments:** a payment or an edit above the amount still due is refused unless *Ignore and record anyway* was chosen. Payments on a draft purchase are refused until it is approved.
- **New route:** `POST /api/purchases/[id]/payments`, the same as the sales payment route.
- **Self-check:** `scripts/test-payment-edit.mjs` (run with `node scripts/test-payment-edit.mjs`).

**Changed**

- **Editing a payment** replaces its amount in place. It is shown in the party ledger as a normal receipt (*Received by …*), not as a correction.
- **Edit mode is safe:** saving while editing never records a new payment. If the payment being edited is gone, edit mode is cancelled with a message.

**Fixed**

- **Correction rows:** changing a paid amount on an invoice or a bill no longer writes a negative *Correction* row. The old `amountPaid` branch is removed from the sales and purchase update routes.
- **Purchase bill payments** no longer send a total, which could record nothing or record a correction when the page showed a stale amount.
- **Product master names** (Settings) showed an error when a name could not be saved or removed, because the toast was not declared. Fixed.

**Not changed (still in place)**

- Old *Correction* rows created by earlier versions still show as *Correction* in the party ledger. They are kept as they are.

### Version 1.0.2

**Fixed**

- **The installed app would not start** (1.0.1 crashed with `Cannot find module 'electron-updater'`). The installer now includes `electron-updater` and its runtime dependencies (see `build.files` in `package.json`).

**Added**

- **Settings → Updates → Check for updates** (desktop app only). A browser shows a note in its place.

### Version 1.0.1

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
