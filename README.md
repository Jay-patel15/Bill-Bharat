# BillBharat

**Offline GST billing, inventory and accounts for Indian businesses: a Windows desktop app, in the spirit of Tally.**

BillBharat makes GST tax invoices, tracks stock, purchases, payments and expenses, and keeps your cash book (Rojmel) and party ledgers, all on your own PC. There is no server and no cloud account: your books are one file in your Windows profile, backed up automatically before every update. It works fully without internet; the only online feature is the optional AI bill reader.

Full guide (using the app, settings, data, how it works, troubleshooting): **[DOCUMENTATION.md](DOCUMENTATION.md)**

---

## What you get

| | |
|---|---|
| **GST invoices** | Tax Invoice, Proforma, Quotation, Purchase Order, Delivery Challan. CGST+SGST or IGST chosen by state, line and bill discounts, rounded total, amount in words. |
| **Industrial invoice print** | The standard bordered A4 GST bill: logo, company name and tagline, GSTIN/PAN/state, Rule 46 notice, Original/Duplicate/Triplicate, challan/order/LR/transporter/e-way/payment details, buyer and consignee, ruled item grid with taxes, bank details, declaration, numbered terms, signatures. Long bills continue onto page 2 by themselves. |
| **Invoice template editor** | Turn any part of the invoice on or off and rename it, with a live A4 preview. Set your own invoice number format (e.g. `INV/{FY}/{###}`). |
| **Company settings** | Edit company name, GSTIN, PAN, address, contacts, logo, bank details and terms & conditions from Settings. |
| **Inventory** | Items with SKU, barcode, HSN, GST rate, unit and stock; sales take stock out, purchases put it in. |
| **Purchases** | Supplier bills typed in, or read from a PDF/photo by AI (optional). |
| **Payments** | Full or part payments on invoices and bills; status follows automatically. |
| **Expenses** | Simple expense manager by head and month. |
| **Rojmel (cash book)** | Every rupee in (Debit) and out (Credit) by cash, UPI, bank or cheque, with running balance. |
| **Party ledger & outstanding** | For every customer and supplier: a detailed running ledger of bills and payments, for all invoices or the ones you tick. Printable PDFs. |
| **Reports** | Sales, GST summary, GSTR-1 JSON, finance overview, audit log, Excel export. |
| **Keyboard first** | Tally-style keys: `F4` contra, `F5` payment, `F6` receipt, `F8` sale, `F9` purchase (each opens a new entry), `Alt+A` save, `Alt+C` quick create, `F2` date, `Enter` next field, `Esc` back. |
| **Safe by default** | Password login with recovery code, automatic daily backups and backups before updates, copies to your own backup folders (Google Drive / OneDrive / Dropbox folder, pen drive, other drive, network share), uploaded files included, a reminder when backups haven't left the PC for 7 days, one-click restore, a password-protected *Reset (erase all books)* that backs up first, multiple companies in one install. |

## Install and use

1. Run `BillBharat-<version>-x64.exe`: the installer asks where to install (default is your user's Programs folder; pick any folder you like) and adds desktop and Start-menu shortcuts, or run `BillBharat-<version>-portable.exe` without installing.
2. **Sign up** and write down the recovery code it shows.
3. **Create your company**, then open **Settings → Company details** to check the name, GSTIN, address, logo and bank details, and **Settings → Terms & Conditions** to set your invoice terms.
4. Add customers and items, then press `F8` to make your first invoice.

Your books live in `%APPDATA%\BillBharat\data\` and backups in `%APPDATA%\BillBharat\backups\` (both reachable from the **File** menu). Reinstalling or updating never touches them. **Both are on C:**, so add an extra backup folder off C: or in a cloud-synced folder (Settings → Backup & Restore) to survive a Windows or drive reset.

---

## Build the Windows .exe

### What you need

- **Windows 10 or 11**, 64-bit.
- **Node.js 20 or newer** (LTS recommended) from nodejs.org. `npm` comes with it.
- **Internet for the first build only**: `npm install` downloads packages, and the first `npm run dist` downloads Electron and the installer tools. The app you build runs offline.
- About 2 GB free disk space.

No `.env` file is needed to build: the packaged app creates its own secret on first launch.

### Steps

Open **PowerShell** or **Command Prompt** in the project folder (the one with `package.json`):

```bash
# 1. Install dependencies (first time, or after package.json changes)
npm install

# 2. Optional: run the self-check (database, accounting, GST math)
npm run check

# 3. Build the installer and the portable exe
npm run dist
```

`npm run dist` does three things in order:

1. `next build` compiles the app.
2. `scripts/prepare-standalone.mjs` copies static files into the bundle, **deletes any `.env*` file and `.data` folder from it**, refuses to continue if any remain (so your keys and test books never ship), and checks the SQLite engine is included.
3. `electron-builder` packages it.

### Output (in `dist\`)

| File | Use |
|---|---|
| `BillBharat-<version>-x64.exe` | Installer: lets you choose the install folder, per-user, desktop and Start-menu shortcuts. Use this for daily work. |
| `BillBharat-<version>-portable.exe` | Single file, no install. Slower to start (it unpacks itself first). |
| `win-unpacked\` | The unpacked app, handy for testing (`BillBharat.exe` inside). |

For a quicker test build without installers: `npm run dist:dir` (produces only `dist\win-unpacked\`).

### Releasing an update

1. Raise `"version"` in `package.json` (for example `1.0.0` → `1.0.1`).
2. Run `npm run dist` and hand out the new installer.
3. Users install over the old version. On first start the app **backs up their books automatically** (`backup_v1.0.0_…db` in the backups folder) before applying any database changes.

### Optional

- **App icon / logo:** the logo is `electron/icon.svg` (a bill with the ₹ sign and a saffron-green stripe). After editing it run `npm run icon` to redraw `electron/icon.png` (used for the exe, installer, window and taskbar; the SVG itself is the start-up splash), and copy the SVG to `app/icon.svg` (sidebar and browser tab).
- **Code signing:** the build is unsigned, so Windows SmartScreen shows "Windows protected your PC" on first run ("More info" → "Run anyway"). To avoid it, sign with a code-signing certificate (electron-builder `win.certificateFile` / `CSC_LINK`).

### If the build fails

| Problem | Fix |
|---|---|
| `Cannot find module './vendor-chunks/…'`, `./1682.js`, or the build hangs | Windows file locks. Close any running BillBharat or `node.exe`, and any terminal opened inside `.next`. Delete the `.next` folder and run `npm run dist` again. |
| `Refusing to package: .env …` | The safety check stopped secrets from shipping. Run `npm run dist` again; if it repeats, delete `.next` first. |
| `SQLite wasm binary missing` | Run `npm install` again, then rebuild. |
| `npm` is not recognised | Install Node.js and reopen the terminal. |

---

## For developers

```bash
npm install
cp .env.example .env.local     # set JWT_SECRET
npm run dev                    # http://localhost:3000 in the browser
npm run dev:app                # second terminal: the desktop window on the dev server
```

Tech: Next.js 14 · React 18 · Tailwind · SQLite (node-sqlite3-wasm) · Electron · jsPDF · Zod.
Architecture, accounting model, database rules and how to change the code safely are in **[DOCUMENTATION.md](DOCUMENTATION.md)**.
