# BillBharat — Operations & Internals Guide

Everything needed to run, understand, modify and ship this app.

BillBharat is a **GST invoicing / inventory / accounting app for Indian businesses, packaged as an offline Windows desktop application.** There is no server, no cloud account and no network dependency. All data is a single SQLite file plus a folder of PDFs on the machine it runs on — the Tally model, with a modern web UI.

---

## Table of contents

1. [Cheat sheet](#1-cheat-sheet)
2. [First-time setup](#2-first-time-setup)
3. [Running the app](#3-running-the-app)
4. [Building the .exe](#4-building-the-exe)
5. [Where your data lives · backup & restore](#5-where-your-data-lives--backup--restore)
6. [How it works internally](#6-how-it-works-internally)
7. [Adding a new feature](#7-adding-a-new-feature)
8. [Verifying your changes](#8-verifying-your-changes)
9. [Troubleshooting](#9-troubleshooting)
10. [Known issues and traps](#10-known-issues-and-traps)

---

## 1. Cheat sheet

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (once) |
| `npm run dev` | Dev server + hot reload → http://localhost:3000 |
| `npm run dev:app` | Desktop window attached to the dev server (run `npm run dev` first) |
| `npm run check` | 17 assertions against the data layer, throwaway DB |
| `npm run build` | Production build + fold assets into the standalone bundle |
| `npm start` | Serve the production build on :3000 (no Electron) |
| `npm run dist` | Build → `dist/` installer **and** portable exe |
| `npm run dist:dir` | Build → `dist/win-unpacked/` (fastest packaging test) |

**Day-to-day loop when writing a feature:** `npm run dev`, edit, refresh. Only run `npm run dist` when you actually want an installer.

---

## 2. First-time setup

### Requirements

- **Node.js 20.x** (`node -v`). Enforced via `engines`.
- **Windows 10/11** for building the exe. Dev works on any OS.
- No compiler, no Python, no MSVC. The SQLite driver is WebAssembly, so there is no native module to build.
- No database server to install.

### Steps

```bash
git clone <repo>
cd <repo>
npm install
```

Then create `.env.local` (dev only — the packaged app needs none of this):

```bash
cp .env.example .env.local
```

Set a session secret in `.env.local`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```ini
JWT_SECRET=<paste the value above>
SESSION_COOKIE_NAME=bb_session
NEXT_PUBLIC_APP_NAME=BillBharat
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEV_BYPASS_AUTH=0

# Optional. Only these two reach the internet; blank = fully offline.
OPENROUTER_API_KEY=
GEMINI_API_KEY=
```

### Environment variables in full

| Variable | Required | Meaning |
|---|---|---|
| `JWT_SECRET` | dev only | Signs the session cookie. The packaged app **generates and stores its own** at first launch, so this is not needed there. |
| `SESSION_COOKIE_NAME` | no | Cookie name, default `bb_session`. |
| `BILLBHARAT_DATA_DIR` | no | Override where the DB and files go. Default: `./.data` in dev; set by Electron in the packaged app. |
| `DEV_BYPASS_AUTH` | no | `1` skips login entirely and injects a dummy admin. **Dev only** — see the warning below. |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | no | Optional AI PDF reading. |
| `GEMINI_API_KEY` | no | Optional AI PDF reading fallback. |
| `NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_APP_URL` | no | Cosmetic / reset-link base. `NEXT_PUBLIC_*` is exposed to the browser — never put a secret in one. |

> **`DEV_BYPASS_AUTH=1` disables all authentication and grants admin.** It also makes `assertCompanyAccess()` skip ownership checks entirely, so one company's data becomes reachable from another. Never set it in a build you hand to anyone.

### First run

Start the app, then:

1. **Sign up** — note that `app/api/auth/signup/route.js` assigns `role: "admin"` to **every** account, which has consequences described in [§10](#10-known-issues-and-traps).
2. You're redirected to **Companies → Create**. Fill in GSTIN, state, bank details, terms. The GST engine needs the **state code** to decide CGST/SGST vs IGST.
3. Add a **customer**, add a few **inventory** items.
4. Create your first **invoice**, download the PDF.

---

## 3. Running the app

There are three ways to run it, for three different purposes.

### A. Browser + hot reload — the normal dev loop

```bash
npm run dev          # http://localhost:3000
```

Fastest iteration. Data goes to `./.data/`. This is what you want 95% of the time.

### B. Desktop window + hot reload — for testing window behaviour

Two terminals:

```bash
npm run dev          # terminal 1 — leave running
npm run dev:app      # terminal 2 — Electron window
```

`electron/main.js` checks `app.isPackaged`. Unpackaged, it skips spawning its own server and loads `http://localhost:3000`, so hot reload still works inside the real window. Override the target with `BB_DEV_URL`.

Use this when changing menus, window sizing, print behaviour, external-link handling, or the splash screen.

### C. Production build without Electron

```bash
npm run build
npm start            # http://localhost:3000, production bundle
```

Useful for reproducing production-only bugs — minification, bundling and CommonJS interop differ from dev. **A real class of bug only appears here** (see [§10](#10-known-issues-and-traps)).

---

## 4. Building the .exe

```bash
npm run dist
```

Produces in `dist/`:

| File | ~Size | Notes |
|---|---|---|
| `BillBharat-1.0.0-x64.exe` | 88 MB | Installer. Per-user, adds desktop + start-menu shortcuts. |
| `BillBharat-1.0.0-portable.exe` | 88 MB | Single file, no installation. |

### What `npm run dist` actually does

```
next build                        → .next/standalone/  (server.js + traced node_modules)
scripts/prepare-standalone.mjs    → copies .next/static and public/ into the bundle,
                                    then asserts the SQLite .wasm is present
electron-builder                  → wraps it as BillBharat.exe + NSIS installer + portable
```

`next build` alone is not enough: Next's standalone output deliberately omits static assets (it assumes a CDN). We serve them from the same process, so `prepare-standalone.mjs` folds them in. It also **fails the build** if `node-sqlite3-wasm.wasm` didn't get traced — better a build error than an app that starts and dies on the first query.

### Installer vs portable — which to use

Prefer the **installer** for daily use. The portable exe self-extracts ~88 MB to `%TEMP%` on every launch, which costs about **30 seconds before the window appears**. The installer has files already on disk and starts in a few seconds.

### Packaging decisions and why

- **`asar: false`** — Next.js reads many build-manifest files at runtime and writes its own cache. An asar archive is read-only and adds a virtual-filesystem layer that the SQLite `.wasm` loader trips over.
- **Per-user install (`oneClick: true, perMachine: false`)** → `%LOCALAPPDATA%\Programs\BillBharat`. Deliberate: the bundled Next server needs a writable directory for its runtime cache, which a `Program Files` install denies to a non-admin user. Your data is in `%APPDATA%` either way, so reinstalling never touches the books.
- **`signAndEditExecutable: false`** — the build is unsigned. Leaving this on makes electron-builder fetch its `winCodeSign` toolchain, whose macOS dylib symlinks cannot be extracted on Windows without Developer Mode or admin rights — which fails the entire build. Consequences: the default Electron icon is used, and **SmartScreen will warn on first run**. Turn this back on once you have a real code-signing certificate.
- **WebAssembly SQLite instead of `better-sqlite3`** — `better-sqlite3` is ~1.7–3.8× faster in synthetic benchmarks, but it is a native addon needing a **separate build per ABI**: one for plain Node (`npm run dev`) and another for Electron. That means a rebuild step between developing and packaging, and a compiler toolchain on every build machine. The wasm driver is one artifact that works identically in both, and at local-file speeds the difference is imperceptible for this workload (a 5,000-row full scan: ~27 ms vs ~17 ms).

---

## 5. Where your data lives · backup & restore

| Context | Path |
|---|---|
| Packaged app | `%APPDATA%\BillBharat\data\` |
| `npm run dev` / `npm start` | `./.data/` (gitignored) |
| Override | `BILLBHARAT_DATA_DIR` |

```
data/
  billbharat.db          all books: companies, invoices, ledgers, everything
  billbharat.db-wal      write-ahead log (present while running)
  billbharat.db-shm      shared-memory index (present while running)
  files/
    invoices/            saved invoice PDFs
    logos/               uploaded company logos
    <subfolder>/         anything else via /api/upload
```

`data/` is a subfolder on purpose — Electron keeps its own Chromium caches (`Cache`, `GPUCache`, `Local Storage`, …) in the parent directory. Keeping the books separate means the backup story is "copy one folder", with no cache noise.

**In-app shortcut:** File → Open Data Folder.

### Backing up

**Quit the app first**, then copy the whole `data/` folder. Quitting checkpoints and removes the `-wal`/`-shm` files, so `billbharat.db` alone is complete and consistent.

Copying while the app is running risks a torn backup unless you copy `billbharat.db`, `-wal` and `-shm` together as a set.

### Restoring

Quit the app, replace `data/`, start it again. The schema is applied on every open and every statement is `IF NOT EXISTS`, so an older DB is upgraded in place rather than rejected.

### What is *not* in the backup

`session-secret` sits in the parent folder, not in `data/`. Restoring onto a different machine therefore invalidates existing login cookies — users simply log in again. Passwords are bcrypt hashes inside the DB, so **nothing is lost**; do not treat the secret as a backup artifact.

---

## 6. How it works internally

### 6.1 Process architecture

```
BillBharat.exe  (Electron main — electron/main.js)
├── generates/reads  %APPDATA%\BillBharat\session-secret
├── picks a free port on 127.0.0.1
├── fork() ──► BillBharat.exe with ELECTRON_RUN_AS_NODE=1
│                 └── resources/server/server.js   (Next.js standalone)
│                        └── node-sqlite3-wasm ──► data/billbharat.db
└── BrowserWindow ──► http://127.0.0.1:<port>
```

Three things worth noting:

- The server is a **child process**, not the main process. A crash in the server is detected via its `exit` event and surfaced as an error dialog instead of a blank window.
- `ELECTRON_RUN_AS_NODE=1` makes the forked process behave as plain Node rather than launching a second GUI. It reuses Electron's bundled Node, so **no separate Node runtime is shipped**.
- The port is **ephemeral and loopback-only**. Nothing is reachable from the network, which is why rate limiting was removed (see [§6.6](#66-tenant-isolation)).

### 6.2 Startup sequence

1. `app.whenReady()` → build the menu, create the window.
2. The window immediately loads an inline `data:` URL **splash** ("Starting BillBharat…"). This exists so the user is never staring at nothing — server boot takes seconds, and the portable build self-extracts first. Without it, a slow launch reads as a crash.
3. `sessionSecret()` reads `session-secret`, or generates 32 random bytes and writes it with mode `0600` on first launch. **The secret is per-installation, never baked into the build** — a shipped secret would be identical for every user.
4. `freePort()` opens a throwaway listener on port 0 to let the OS pick a free port, then closes it.
5. `fork()` the standalone server with `PORT`, `HOSTNAME=127.0.0.1`, `JWT_SECRET`, `BILLBHARAT_DATA_DIR`, `NODE_ENV=production`.
6. `waitForServer()` polls the URL every 150 ms until it answers, with a 60 s deadline.
7. On success the window swaps the splash for the real app URL. On failure: error dialog, then quit.

Also handled: a **single-instance lock** (a second launch focuses the existing window rather than starting a second server against the same database), and `will-quit` killing the server child.

### 6.3 Request lifecycle, end to end

Tracing "user saves an invoice":

**1. Client** — `components/company-context.jsx` exports an `api()` helper used by every page. It:
- reads the active company id from `localStorage["bb.activeCompanyId"]` and attaches it as the **`x-company-id`** header;
- short-circuits company-scoped endpoints when no company is selected, returning `[]` for GETs so pages render an empty state instead of an error overlay;
- sets `content-type: application/json` unless the body is `FormData`;
- unwraps `{ ok, data }` and throws an `Error` carrying `.status` on failure.

**2. Middleware** — `middleware.js` runs on every non-static request. It applies security headers and checks **only whether a session cookie exists**. If not: browser requests redirect to `/login`, `/api/*` requests get a 401 JSON body.

**3. Route handler** — `app/api/sales/route.js`:

```js
export async function POST(req) {
  return withUser(async (user) => {         // ← real session verification
    const body = await readBody(req);
    const companyId = body.companyId || getCompanyIdFromRequest(req);
    await assertCompanyAccess(user, companyId);   // ← tenant isolation

    const parse = saleSchema.safeParse(body);     // ← Zod, fail closed
    if (!parse.success) return fail(..., 400);
    // ... compute GST, insert, side-effects
  });
}
```

**4. Side-effects**, in order, all gated on the document type's flags:
- `computeInvoice()` recomputes every total server-side — client-supplied totals are never trusted;
- invoice number is generated (or a duplicate within the company is rejected with 409);
- the `sales` row is inserted;
- if `affectsStock`: inventory quantities are decremented;
- if `affectsOutstanding`: the customer's `outstanding` is increased, and `recordSaleAccounting()` writes the double-entry ledger rows.

**5. Response** — `ok(data)` → `{ ok: true, data }`; `fail(msg, status)` → `{ ok: false, error }`.

### 6.4 The data layer

Two files, one responsibility each.

**`lib/db/sqlite.js`** — the driver. Exposes `query()` / `queryOne()` with the same signatures the old Postgres pool had, which is why the swap touched almost nothing above it.

- **Placeholder rewriting.** `lib/db.js` emits Postgres-style `$1, $2, …`; SQLite wants `?`. A `replace(/\$\d+/g, "?")` handles it because every generated statement numbers its placeholders in the same order as the params array.
- **Prepared-statement cache.** `Map<sql, stmt>`, capped at 300 entries as a runaway guard. Finalizing is wrapped in a `try/catch` — `sqlite3_finalize()` re-reports the statement's *last* error, so finalizing a statement that once hit a constraint violation would otherwise throw inside an unrelated request.
- **Type normalisation.** `bindable()` converts `undefined`→`null`, booleans→`0/1`, `Date`→ISO string, and plain objects→JSON, so a stray value surfaces as stored data rather than a 500.
- **Pragmas**, applied on open:

  | Pragma | Why |
  |---|---|
  | `journal_mode = WAL` | Reads proceed during writes |
  | `synchronous = NORMAL` | fsync at checkpoints, not every commit — safe against process crash, which is the failure mode that matters on a desktop |
  | `foreign_keys = ON` | Referential integrity actually enforced |
  | `busy_timeout = 5000` | Wait rather than fail on a momentary lock |
  | `cache_size = -64000` | 64 MB page cache |
  | `temp_store = MEMORY` | Temp b-trees in RAM |

- **Concurrency.** The driver is *synchronous*. A query runs to completion without yielding to the event loop, so concurrent requests in one Next process cannot interleave mid-statement and no application-level locking is needed.

**`lib/db.js`** — the generic row store every route uses:

| Function | Notes |
|---|---|
| `listAll(table)` | Full scan |
| `findWhere(table, filters)` | **Object** filter → SQL `WHERE` (uses indexes). A **function** filter → full scan + JS filter, kept for compatibility |
| `findOne(table, filters)` | As above, `LIMIT 1` |
| `findById(table, id)` | Returns `null` for a missing or falsy id, never throws |
| `insert(table, record)` | Generates a UUID, stamps `createdAt`/`updatedAt`, returns the row |
| `update(table, id, patch, userId?)` | Stamps `updatedAt`, writes a fire-and-forget audit log |
| `remove(table, id, userId?)` | Writes an audit log with the full prior row |
| `assertCompanyAccess(user, companyId)` | Tenant guard — see [§6.6](#66-tenant-isolation) |
| `SCHEMAS` | Column lists per table |

**Prefer the object form of `findWhere`.** `findWhere("sales", { companyId })` hits an index; `findWhere("sales", s => s.companyId === id)` reads the whole table into JS first.

#### JSON columns — the one real behavioural subtlety

Postgres `JSONB` was parsed to objects automatically by the `pg` driver. SQLite stores TEXT and hands back strings. To keep every caller unchanged, `lib/db.js` funnels **every** row leaving the module through `formatRow()`, which parses the JSON columns and unpacks the company template. `JSONB_COLUMNS` declares them:

| Table | JSON columns |
|---|---|
| `sales`, `purchases` | `items` |
| `projects` | `boqItems` |
| `journal_entries` | `entries` |
| `audit_logs` | `oldData`, `newData` |

So `sale.items` is an **array**, not a string — on insert, on update's `RETURNING`, and on every read. Invalid JSON degrades to `null` rather than throwing, so one corrupt blob cannot take down an entire invoice list.

**If you add a JSON column, you must add it to `JSONB_COLUMNS`** or callers will receive a raw string.

#### Company terms packing

`companies.termsAndConditions` physically stores a JSON envelope holding both the terms text *and* the invoice template. `formatCompanyRow()` unpacks it into `termsAndConditions` + `invoiceTemplate`; `packCompanyTerms()` repacks on write, merging the existing template when a patch omits it. Historical layout, preserved deliberately.

### 6.5 Schema and migrations

The schema is **inlined as a JS string** in `lib/db/schema.js` — not read from a `.sql` file — so the packaged exe has no runtime file lookup to get wrong.

Every statement is `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`, and the whole script is executed on **every** database open. That is both first-run setup and the migration path: **adding a table or an index requires no migration tooling at all.**

12 tables: `users`, `companies`, `customers`, `inventory`, `projects`, `sales`, `purchases`, `product_mappings`, `payments`, `ledger_entries`, `journal_entries`, `audit_logs`.

Postgres → SQLite type mapping:

| Postgres | SQLite | Effect |
|---|---|---|
| `TIMESTAMPTZ`, `DATE` | `TEXT` | ISO strings; JSON output is unchanged from before |
| `NUMERIC(x,y)` | `REAL` | Arrives as a JS number, as it did with the `pg` type parser |
| `JSONB` | `TEXT` | Parsed back by `formatRow()` |

Dropped from the Postgres version, deliberately:

- **`pgcrypto` / `gen_random_uuid()`** — ids come from `randomUUID()` in `lib/db.js`.
- **`set_updated_at` triggers** — `lib/db.js` writes `updatedAt` itself.
- **RLS policies** — there is no database server to enforce them in. Isolation moved to the application layer.

> **Changing an *existing* column's type or constraints is the one case `IF NOT EXISTS` cannot handle** — the table already exists, so the new definition is ignored. Write an explicit `ALTER TABLE` for that.

### 6.6 Tenant isolation

With RLS gone, `assertCompanyAccess(user, companyId)` in `lib/db.js` is the **only** gate protecting one company's data from another. Every company-scoped route must call it, and a new route that forgets it has no second line of defence.

```js
export async function assertCompanyAccess(user, companyId) {
  if (!companyId) throw 400;
  if (user.role === "admin" || process.env.DEV_BYPASS_AUTH === "1") return true;   // ← early exit
  const company = await findById("companies", companyId);
  if (!company || company.userId !== user.id) throw 403;
  return true;
}
```

Two things to know about this function as it currently stands:

- It returns `true`, **not the company row** — two routes assume otherwise.
- The `role === "admin"` early exit means **the ownership check never runs**, because signup assigns `admin` to every account.

Both are covered in [§10](#10-known-issues-and-traps). Read that before relying on this guard.

**Rate limiting was removed** along with the move to a desktop app: the server binds to an ephemeral loopback port and is unreachable from the network, so there is no remote brute-force surface to throttle. bcrypt still protects the login form itself. **Reinstate it if this is ever exposed over a network again.**

### 6.7 Authentication and sessions

- Login/signup verify credentials with **bcrypt** (cost 10), then `signSession()` issues a **JWT (`jose`, HS256, 7-day)** stored in an **httpOnly, sameSite=lax** cookie named `bb_session`.
- Signup assigns `role: "admin"` to every account, which matters more than it looks — see [§10.1](#101-every-account-is-an-admin-so-tenant-isolation-never-executes).
- `getCurrentUser()` (`lib/auth.js`) reads and verifies the cookie on every request. `withUser()` / `requireUser()` wrap it and fail closed with 401.
- The `(app)` layout calls `getCurrentUser()` server-side and redirects to `/login` when absent, so no protected page renders for an anonymous user.

**Why middleware does not verify the signature.** Next.js middleware runs in the Edge runtime, where `process.env` values can be inlined at build time. The packaged app generates its `JWT_SECRET` at *first launch*, so a build-time value would be the wrong one. Middleware therefore does the cheap routing check (is a cookie present?) and leaves verification to `getCurrentUser()`, which runs in the Node runtime on every request. A forged or expired cookie gets past the redirect and is then rejected server-side.

> The cookie sets `secure: true` under `NODE_ENV=production`. Chromium treats `http://127.0.0.1` as a trustworthy origin, so this works in Electron. Non-Chromium HTTP clients (and some scripting libraries) will refuse to send a `Secure` cookie over plain HTTP — worth knowing when writing scripts against a packaged instance.

### 6.8 File storage

`lib/storage/local.js` keeps the interface the previous cloud adapter had, so callers didn't change:

```js
uploadFile({ data, filename, mimeType, subfolder }) → { id, name, viewUrl, downloadUrl, embedUrl }
downloadFile(id) → Buffer
deleteFile(id)
```

Files land at `data/files/<subfolder>/<timestamp>-<safeName>` and are served back through **`GET /api/files/<id>`**, which:

- requires a valid session (`withUser`) — these are financial documents;
- resolves the path through `resolveStoragePath()`, which rejects anything escaping the files directory (verified against `../`, `%2e%2e%2f` and mixed encodings);
- infers `content-type` from the extension, defaulting to a binary download;
- sets a long `immutable` cache header, safe because the filename carries a timestamp.

`GET /api/sales/[id]/pdf` renders the invoice on demand. With `?save=1` it also archives a copy and stores the URL on `sales.pdfUrl`. A failed archive is logged but does not block viewing the PDF.

### 6.9 The GST engine

`lib/gst.js` is pure and side-effect free — the easiest part of the system to test.

- `gstStateFromGstin(gstin)` — the first 2 digits of a GSTIN are the state code.
- `isInterstate(a, b)` — `true` only when both codes are present **and differ**. Missing either code returns `false`, i.e. it falls back to treating the sale as intra-state.
- `computeLine(item, interstate)` → per-line `taxable`, `cgst`, `sgst`, `igst`, `total`.
  - Intra-state → `cgst = sgst = tax/2`. Inter-state → `igst = tax`.
  - **Price comes from `item.sellingPrice ?? item.price`.** `item.rate` is accepted by the Zod schema but **ignored for pricing** — pass `sellingPrice` or the line computes to zero.
- `computeInvoice({ items, supplierStateCode, recipientStateCode, invoiceDiscount })` → totals plus `roundOff` and `grandTotal`, all rounded to 2 dp.

Slabs: 0 / 5 / 12 / 18 / 28 %, per line. Discounts apply per line and at invoice level, both reducing the taxable value before tax.

**Document types** (`lib/utils.js` → `DOCUMENT_TYPES`) drive the side-effects:

| Type | Prefix | Taxable | Moves stock | Affects outstanding |
|---|---|---|---|---|
| Tax Invoice | `INV` | yes | yes | yes |
| Proforma Invoice | `PI` | yes | no | no |
| Purchase Order | `PO` | yes | no | no |
| Delivery Challan | `DC` | **no** | yes | no |
| Quotation | `QT` | yes | no | no |

### 6.10 Double-entry accounting

`lib/accounting.js` writes `ledger_entries` rows.

- `recordSaleAccounting(sale, customerName)` — debit the customer for the gross total; credit `Sales Account` for the taxable value; credit `CGST/SGST/IGST Output` for each tax component; debit `Discount Allowed` if a discount applies.
- `recordJournalEntry(companyId, { date, description, entries })` — **rejects unbalanced entries** (debits must equal credits within ₹0.01), stores the entry, then expands it into individual ledger rows.
- `LEDGERS` holds the standard Tally-style ledger names.

The daybook / Rojmel reports read back over `ledger_entries`.

### 6.11 Optional AI PDF reading

`lib/ai.js` is the **only** code that reaches the internet. It tries OpenRouter first, falls back to Gemini, and throws a clear error if neither key is configured. Everything else works fully offline. The `/purchase/ai-upload` and `/sales/ai-upload` pages are the entry points.

---

## 7. Adding a new feature

### Recipe A — add a column to an existing table

Three places, in order:

1. **`lib/db/schema.js`** — add the column to the `CREATE TABLE`. *For a brand-new database this is enough.* For an existing one, also run an `ALTER TABLE` (see the note in [§6.5](#65-schema-and-migrations)).
2. **`lib/db.js` → `SCHEMAS`** — add the column name.
3. **`lib/validations.js`** — add the field to the relevant Zod schema, or the API will drop it.

If the column holds JSON, also add it to `JSONB_COLUMNS` in `lib/db.js`.

Then `npm run check` and exercise the route.

### Recipe B — add a whole new entity

```
lib/db/schema.js       CREATE TABLE + indexes (companyId index at minimum)
lib/db.js              add to SCHEMAS
lib/validations.js     Zod schema
app/api/<thing>/route.js          GET (list) + POST (create)
app/api/<thing>/[id]/route.js     GET / PUT / DELETE
app/(app)/<thing>/page.jsx        UI
lib/navigation.js      sidebar entry
```

CRUD, JSON handling, `updatedAt` and the audit log all come from `lib/db.js` for free.

### Recipe C — a new API route (the template)

```js
import { fail, ok, readBody, withUser } from "@/lib/api";
import { assertCompanyAccess, getCompanyIdFromRequest, findWhere, insert } from "@/lib/db";
import { thingSchema } from "@/lib/validations";

export async function GET(req) {
  return withUser(async (user) => {
    try {
      const companyId = getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);          // ← never omit
      return ok(await findWhere("things", { companyId }));  // ← object filter, uses the index
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

export async function POST(req) {
  return withUser(async (user) => {
    try {
      const body = await readBody(req);
      const companyId = body.companyId || getCompanyIdFromRequest(req);
      await assertCompanyAccess(user, companyId);

      const parse = thingSchema.safeParse(body);
      if (!parse.success) return fail(parse.error.errors[0]?.message || "Invalid payload", 400);

      return ok(await insert("things", { ...parse.data, companyId }));
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
```

Non-negotiables:

- **`withUser`** — session verification. Middleware does not do it for you.
- **`assertCompanyAccess`** — the only tenant gate.
- **Zod `safeParse`** — fail closed on bad input.
- **Recompute money server-side.** Never persist a total the client sent.
- Add the path prefix to `COMPANY_SCOPED` in `components/company-context.jsx` if it needs an active company.

### Recipe D — a new page

Put it under `app/(app)/` to inherit the authenticated shell (sidebar, topbar, company switcher, toasts). Client pages use:

```jsx
"use client";
import { api, useCompany } from "@/components/company-context";

const { active } = useCompany();
useEffect(() => { if (active?.id) load(); }, [active?.id]);   // reload on company switch
```

`api()` attaches `x-company-id` automatically. Re-running on `active?.id` is what makes the company switcher work.

### Recipe E — changing tax logic

Edit `lib/gst.js` only. It is pure, so add a case to `scripts/check-db.mjs` or a small script asserting the numbers. Remember `sellingPrice`, not `rate`.

### Working on the desktop shell

`electron/main.js` changes need a repack — hot reload does not cover the main process:

```bash
npm run dist:dir     # then run dist/win-unpacked/BillBharat.exe
```

For window/menu work, `npm run dev:app` is faster since it skips the Next build entirely.

---

## 8. Verifying your changes

### The data-layer self-check

```bash
npm run check
```

17 assertions covering placeholder rewriting, JSON round-trips, numeric types, both filter forms, company template packing, foreign-key enforcement, the audit log, persistence across a reopen, and the finalize-after-constraint-violation regression. It runs against a throwaway DB in the OS temp dir and never touches real data.

**How it loads the data layer, and why it looks odd.** The data layer is ESM, but the project's `package.json` has no `"type": "module"` — Next transpiles these files, plain `node` does not. So `check-db.mjs` copies the four data-layer files into a gitignored `.check-tmp/` **inside the project** (so `node_modules` still resolves by walking up), drops a `{"type":"module"}` marker beside them, and imports from there.

> **Do not "simplify" this by adding `lib/package.json` with `{"type":"module"}`.** It looks like the obvious fix and it silently breaks PDF generation: several modules in `lib/` default-import CommonJS packages (`jspdf-autotable`, `jose`, `zod`), whose interop changes under strict ESM. The failure is a minified `o is not a function` **that only appears in a production build** — dev looks perfectly fine.

### Manual smoke test

```bash
npm run dev
# sign up → create company (set state code!) → add customer → add inventory
# → create invoice → open the PDF → check the dashboard totals
```

Then before shipping:

```bash
npm run build && npm start     # catches production-only bundling bugs
npm run dist:dir               # catches packaging bugs
```

The three environments genuinely differ. A change can pass `npm run dev` and still fail in `npm start` (minification, CJS interop) or in the package (file tracing, missing assets).

---

## 9. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `JWT_SECRET not set` | Dev only. Copy `.env.example` → `.env.local` and set it. The packaged app manages its own. |
| Build hangs, low CPU, `.next` half-written | A previously started server still holds files in `.next`. **Windows file locks.** Kill stray `node.exe` / `BillBharat.exe`, delete `.next`, rebuild. |
| `SQLite wasm binary missing from the bundle` | File tracing missed the `.wasm`. Check `outputFileTracingIncludes` in `next.config.js`. Deliberately fails the build rather than the app. |
| Portable exe: nothing happens for ~30 s | Expected — it self-extracts 88 MB. The splash appears as soon as Electron starts. Use the installer for daily use. |
| SmartScreen warns on first run | The build is unsigned. "More info" → "Run anyway", or sign it (see [§4](#4-building-the-exe)). |
| `o is not a function` in production only | CommonJS interop. Something made a `lib/` module strict ESM — see the warning in [§8](#8-verifying-your-changes). |
| Invoice totals come out `0` | Line items were sent with `rate` instead of **`sellingPrice`**. See [§6.9](#69-the-gst-engine). |
| A new column silently isn't saved | Missing from `SCHEMAS` (`lib/db.js`) or from the Zod schema. |
| A JSON column reads back as a string | Missing from `JSONB_COLUMNS` (`lib/db.js`). |
| AI upload errors out | No `OPENROUTER_API_KEY` / `GEMINI_API_KEY`. Expected; everything else works offline. |
| AI returns blank items | Image-only PDF. The default model reads text PDFs; OCR needs a higher-tier multimodal model. |
| Pages render but lists are empty | No active company selected. `api()` short-circuits company-scoped GETs to `[]`. |
| `database is locked` | Another instance has it open. The single-instance lock normally prevents this; check for stray processes. |

### Resetting to a clean slate

```bash
# dev
rm -rf .data

# packaged  (PowerShell) — deletes ALL books, back up first
Remove-Item -Recurse -Force "$env:APPDATA\BillBharat"
```

---

## 10. Known issues and traps

Three findings below predate the SQLite migration and are **not** fixed in the code. They are documented rather than silently changed; the first two share a single root cause and a single fix.

### 10.1 Every account is an admin, so tenant isolation never executes

`app/api/auth/signup/route.js:28` assigns `role: "admin"` **unconditionally** — not just to the first account:

```js
const user = await insert("users", { email, passwordHash, name, role: "admin" });
```

`assertCompanyAccess()` then short-circuits on exactly that role:

```js
if (user.role === "admin" || process.env.DEV_BYPASS_AUTH === "1") return true;
```

So for every user the guard returns `true` immediately and the `company.userId !== user.id` ownership check is **never reached**. Any logged-in user can read or write any company's data by supplying its `companyId` in the `x-company-id` header.

On a single-user desktop install this is largely theoretical. It stops being theoretical the moment a second person gets an account on the same machine, or this is ever exposed over a network.

**Fix:** stop defaulting to admin. Grant it to the first user only, or introduce an explicit role assignment:

```js
const isFirstUser = (await listAll("users")).length === 0;
const user = await insert("users", { email, passwordHash, name, role: isFirstUser ? "admin" : "user" });
```

Existing accounts already carry `role: "admin"` in the database and will need updating by hand.

### 10.2 `assertCompanyAccess()` returns `true`, not the company — so IGST is never applied

`app/api/sales/route.js:26` and `app/api/purchases/route.js:24` both do:

```js
const company = await assertCompanyAccess(user, companyId);   // → true, a boolean
const supplierStateCode = company.stateCode || gstStateFromGstin(company.gstNumber);
```

`company` is the boolean `true`, so `company.stateCode` and `company.gstNumber` are `undefined`, and `supplierStateCode` ends up empty. `isInterstate()` returns `false` whenever either code is missing, so the sale is treated as intra-state.

**Combined with 10.1 this affects every invoice, for every user**: because the admin branch returns before `findById()` runs, the company row is never fetched on any code path. The practical effect is that **inter-state sales are taxed as CGST+SGST instead of IGST** — a GST correctness bug, not merely a cosmetic one.

**Fix** — have the guard return the row it already needs to fetch, and check the role without skipping the fetch:

```js
export async function assertCompanyAccess(user, companyId) {
  if (!companyId) { const e = new Error("Company ID required"); e.status = 400; throw e; }
  const company = await findById("companies", companyId);
  if (!company) { const e = new Error("FORBIDDEN"); e.status = 403; throw e; }
  if (user.role !== "admin" && process.env.DEV_BYPASS_AUTH !== "1" && company.userId !== user.id) {
    const e = new Error("FORBIDDEN"); e.status = 403; throw e;
  }
  return company;
}
```

The 32 call sites that use it purely as a guard ignore the return value and are unaffected. One deliberate behaviour change: admin and bypass callers now also require the company to exist. It costs one indexed `findById` per company-scoped request.

**After changing this, verify an inter-state invoice actually produces IGST** — that path has never run correctly, so it is untested rather than merely unverified.

### 10.3 The password-reset endpoint returns the reset token in its HTTP response

`app/api/auth/forgot/route.js:23` responds with a working reset link:

```js
return ok({ sent: true, resetUrl: `${baseUrl}/reset-password?token=${token}&email=...` });
```

This is intentional scaffolding — there is no mail service wired up, so the link is handed back for development. It is a public, unauthenticated route (`/api/auth/forgot` is in `PUBLIC_API_PREFIXES`), which makes it a complete account-takeover primitive for anyone who can reach the port and knows an email address. The route does correctly avoid user enumeration by always returning `sent: true`.

Locally that means local access only. **Do not expose this app on a network until the link is emailed instead of returned.**

### 10.4 Other traps, in one place

- **`item.rate` is ignored for pricing** — `computeLine` uses `sellingPrice ?? price`.
- **Never add `{"type":"module"}` to `lib/`** — breaks `jspdf-autotable` in production builds only.
- **`IF NOT EXISTS` won't alter an existing column** — needs an explicit `ALTER TABLE`.
- **New JSON column → add to `JSONB_COLUMNS`**, or callers get a raw string.
- **New route → `withUser` + `assertCompanyAccess`**, or it is wide open.
- **Signup grants `role: "admin"` to everyone**, which disables the ownership check — see [§10.1](#101-every-account-is-an-admin-so-tenant-isolation-never-executes).
- **Function-predicate `findWhere` does a full table scan** — prefer the object form.
- **`DEV_BYPASS_AUTH=1` disables auth and cross-company checks.** Never ship it.
- **Windows file locks** — stop every server before building.
- **`/api/health` is statically prerendered** at build time, so its `time` field is the build time, not the current time. Harmless (it is only a readiness ping) but do not read anything into that timestamp.
- **Stale dev artifacts:** `.data/` may still contain `companies.json`, `customers.json`, `sales.json` from a pre-database era. Nothing reads them; delete them freely.

### 10.5 Deliberately not implemented

- **Emailing password resets.** The reset flow generates a one-hour link; with no mail service wired up, the link is returned in the API response — see [§10.3](#103-the-password-reset-endpoint-returns-the-reset-token-in-its-http-response).
- **Multi-device / concurrent access.** One machine, one database file. Multiple user accounts work; simultaneous access from other devices would need a networked deployment — at which point restore rate limiting and reconsider the middleware trade-off in [§6.7](#67-authentication-and-sessions).
- **Auto-update.** No update server. Shipping a new version means shipping a new installer; `%APPDATA%\BillBharat\data` is untouched by reinstalling.

### 10.6 Recent UI and Ops Fixes Log

- **Unit Input Deletion / Backspace Bug**: Fixed `value={it.unit || "PCS"}` fallback bug to `value={it.unit ?? ""}` across Create Invoice (`app/(app)/sales/create-invoice/page.jsx`), Purchase Form (`components/purchase-form.jsx`), and Inventory (`app/(app)/inventory/page.jsx`). Previously, clearing "P" evaluated `"" || "PCS"` back to `"PCS"`, preventing backspacing.
- **GST Master Unit Suggestions**: Added `<datalist>` containing standard Indian GST accounting units (`PCS`, `NOS`, `KG`, `L`, `MTR`, `BOX`, `SET`, `SQFT`, `SQM`, `GMS`, `TON`, `BAG`, `BTL`, `PAC`, `DOZ`, `RFT`, `JOB`, `HRS`, `CAN`, `KLR`) while leaving the input open for custom units.
- **Database & Foreign Key Auto-Seeding (`lib/auth.js`)**: Fixed `SQLite3Error: FOREIGN KEY constraint failed` when saving companies under `DEV_BYPASS_AUTH=1` by automatically resolving/seeding the `dev-user-id` in the SQLite `users` table.
- **Local SQLite Engine (`lib/db/sqlite.js`)**: Removed PostgreSQL / `pg` dependencies in favor of 100% offline `node-sqlite3-wasm` local storage in `./.data/billbharat.db`.
- **UI Table & PDF Unit Integration**: Added `Unit` column visibility to the Items table in Create Invoice, Purchase Bills, Sale Detail view (`/sales/[id]`), and PDF invoice output (`lib/pdf.js`).
