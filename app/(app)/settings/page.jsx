"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { AlertTriangle, Building2, FileText, KeyRound, RefreshCw, ScrollText, Tags, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { api, useCompany } from "@/components/company-context";
import { NoCompanySelected } from "@/components/empty-state";
import { BackupCard, ResetCard } from "@/components/backup-card";
import { useToast } from "@/components/ui/toast";

function Section({ icon: Icon, title, hint, children }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
        <div className="rounded-md bg-primary/10 p-2"><Icon className="h-5 w-5 text-primary" /></div>
        <div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

/** Gemini key for the optional AI purchase-bill reader. Stored encrypted on this PC. */
function GeminiKey() {
  const [status, setStatus] = useState({ hasKey: false, maskedKey: "" });
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api("/api/settings/ai").then(setStatus).catch(() => {}); }, []);

  async function run(fn) {
    setBusy(true); setMsg(null);
    try { setMsg({ ok: true, text: await fn() }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  }

  const save = (e) => { e.preventDefault(); run(async () => {
    const res = await api("/api/settings/ai", { method: "POST", body: JSON.stringify({ apiKey: key }) });
    setStatus(res); setKey("");
    return res.message;
  }); };
  const test = () => run(async () => (await api("/api/settings/ai/test", { method: "POST", body: JSON.stringify({ apiKey: key || undefined }) })).message);
  const remove = () => confirm("Remove the Gemini API key? AI bill reading stops until a new key is added.") && run(async () => {
    const res = await api("/api/settings/ai", { method: "DELETE" });
    setStatus(res);
    return res.message;
  });

  return (
    <Section icon={KeyRound} title="Gemini AI bill reader (optional)" hint="Reads purchase bills from PDF or photo. Needs internet only while reading.">
      <p className="text-sm">
        Status: {status.hasKey ? <b className="text-emerald-700">Key saved ({status.maskedKey})</b> : <b className="text-muted-foreground">Off: no key</b>}
      </p>
      <form onSubmit={save} className="flex flex-wrap gap-2">
        <Input type="password" className="flex-1 min-w-[220px]" placeholder="Paste API key from aistudio.google.com/app/apikey"
          value={key} onChange={(e) => setKey(e.target.value)} />
        <Button type="submit" size="sm" disabled={busy || key.trim().length < 10}>Save</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || (!key && !status.hasKey)} onClick={test}>Test</Button>
        {status.hasKey && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={remove}>Remove</Button>}
      </form>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>{msg.text}</p>}
    </Section>
  );
}

/** Recovery code for the password reset on the login page. Stored hashed, so a new one is made and shown once. */
function RecoveryCode() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function regenerate() {
    if (!confirm("Make a new recovery code? The old one will stop working.")) return;
    setBusy(true); setErr("");
    try { setCode((await api("/api/auth/recovery-code", { method: "POST" })).recoveryCode); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Section icon={KeyRound} title="Recovery code" hint="Used to reset your password if you forget it. Shown only once, so write it down.">
      <Button size="sm" variant="outline" disabled={busy} onClick={regenerate}>{code ? "Make another code" : "Make new recovery code"}</Button>
      {code && <p className="font-mono text-lg font-semibold tracking-wider">{code}</p>}
      {err && <p className="text-sm text-destructive">{err}</p>}
    </Section>
  );
}

/** Checks GitHub for a newer BillBharat and installs it on request. Desktop app only. */
function UpdateCard() {
  const [desktop, setDesktop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { setDesktop(Boolean(window.billbharatDesktop)); }, []);

  async function check() {
    setBusy(true); setMsg(null);
    try {
      const r = await window.billbharatDesktop.checkForUpdates();
      if (r.status === "latest") setMsg({ ok: true, text: `You have the latest version (${r.version}).` });
      else if (r.status === "dev") setMsg({ ok: true, text: "Updates are checked in the installed app only." });
      else if (r.status === "error") setMsg({ ok: false, text: `Could not check for updates: ${r.message}` });
      else if (r.status === "available") {
        if (!confirm(`Version ${r.version} is available. Download it and restart BillBharat now? Your books are kept.`)) {
          setMsg({ ok: true, text: `Version ${r.version} is available. Press Check again to install it.` });
          return;
        }
        setMsg({ ok: true, text: `Downloading version ${r.version}…` });
        const i = await window.billbharatDesktop.installUpdate();
        if (i.status === "error") setMsg({ ok: false, text: `Update failed: ${i.message}` });
      }
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  }

  return (
    <Section icon={RefreshCw} title="Updates" hint="Looks for a newer BillBharat on GitHub. Your books are not changed by an update.">
      {desktop
        ? <Button size="sm" variant="outline" disabled={busy} onClick={check}>{busy ? "Checking…" : "Check for updates"}</Button>
        : <p className="text-sm text-muted-foreground">Works in the BillBharat desktop app only (not in a browser on localhost).</p>}
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>{msg.text}</p>}
    </Section>
  );
}

const TERMS_EXAMPLE = [
  "Payment is to be made by Payee's A/C Cheque/D.D/Neft/Rtgs.",
  "Interest @ 24% will be charged if bill not paid till Due Date.",
  "Our responsibility ceases the moment goods leave our premises.",
  "Subject To Mumbai Jurisdiction."
].join("\n");

/** The company's terms & conditions, printed numbered at the foot of every invoice. */
function TermsEditor() {
  const { active, refresh } = useCompany();
  const [text, setText] = useState(active.termsAndConditions || "");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(active.termsAndConditions || ""); }, [active.id, active.termsAndConditions]);

  async function save(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api(`/api/companies/${active.id}`, { method: "PUT", body: JSON.stringify({ termsAndConditions: text.trim() }) });
      await refresh();
      setMsg({ ok: true, text: "Terms saved. New invoice PDFs use them." });
    } catch (err) { setMsg({ ok: false, text: err.message }); }
    finally { setBusy(false); }
  }

  return (
    <Section icon={ScrollText} title="Terms & Conditions" hint="One term per line; they are numbered 1, 2, 3… on the invoice.">
      <form onSubmit={save} className="space-y-2">
        <Textarea rows={5} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={TERMS_EXAMPLE} />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={busy || text.trim() === (active.termsAndConditions || "").trim()}>{busy ? "Saving…" : "Save terms"}</Button>
          {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>{msg.text}</span>}
        </div>
      </form>
    </Section>
  );
}

/** Master product names: what the AI reader maps supplier wording onto. */
function ProductNames() {
  const toast = useToast();
  const [list, setList] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const load = () => api("/api/product-mappings").then((l) => setList(l || [])).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    const items = [...new Set(text.split("\n").map((l) => l.trim()).filter(Boolean))];
    if (!items.length) return;
    setBusy(true);
    try {
      await api("/api/product-mappings", { method: "POST", body: JSON.stringify({ items }) });
      setText("");
      await load();
    } catch (err) { toast({ type: "error", title: "Failed", message: err.message }); }
    finally { setBusy(false); }
  }

  async function remove(id) {
    if (!confirm("Remove this product name?")) return;
    try {
      await api(`/api/product-mappings/${id}`, { method: "DELETE" });
      setList((prev) => prev.filter((m) => m.id !== id));
    } catch (err) { toast({ type: "error", title: "Failed", message: err.message }); }
  }

  /** CSV of names: the column headed name/product/item, else the first column. Only names not already listed are added. */
  async function importCsv(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again still fires
    if (!file) return;
    setBusy(true);
    try {
      const wb = XLSX.read(await file.text(), { type: "string" });
      const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false });
      const headers = ["name", "product", "productname", "item", "itemname"];
      const head = (grid[0] || []).map((h) => String(h).replace(/^﻿/, "").trim().toLowerCase());
      const named = head.findIndex((h) => headers.includes(h));
      const body = named >= 0 ? grid.slice(1) : grid;
      const names = body.map((r) => String(r[named >= 0 ? named : 0] ?? "").replace(/^﻿/, "").trim()).filter(Boolean);
      if (names.length > 5000) return toast({ type: "error", title: "Too many names", message: "Import at most 5000 names at a time." });

      const known = new Set(list.map((m) => String(m.realName || "").trim().toLowerCase()));
      const items = [];
      for (const n of names) {
        const key = n.toLowerCase();
        if (known.has(key)) continue;
        known.add(key);
        items.push(n);
      }
      if (items.length === 0) return toast({ type: "info", title: "No new names", message: `All ${names.length} name(s) in the file are already listed or repeated.` });
      await api("/api/product-mappings", { method: "POST", body: JSON.stringify({ items }) });
      const skipped = names.length - items.length;
      toast({ type: "success", title: `${items.length} name(s) added`, message: skipped ? `${skipped} already listed or repeated, skipped.` : undefined });
      await load();
    } catch (err) {
      toast({ type: "error", title: "Import failed", message: err.message });
    } finally { setBusy(false); }
  }

  return (
    <Section icon={Tags} title="Product master names" hint="One name per line, or import a CSV with a name column. The AI reader matches supplier item names to these.">
      <form onSubmit={add} className="space-y-2">
        <Textarea rows={3} placeholder={"TMT Bar 12mm\nCement OPC 53"} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={busy || !text.trim()}>{busy ? "Adding…" : "Add names"}</Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Import names from CSV
          </Button>
        </div>
      </form>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
      {list.length > 0 && (
        <ul className="max-h-64 overflow-auto divide-y rounded border text-sm">
          {list.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-3 py-1.5">
              <span>{m.realName}{m.systemName && m.systemName !== m.realName ? <span className="text-muted-foreground"> → {m.systemName}</span> : null}</span>
              <button onClick={() => remove(m.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${m.realName}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Company default for the low-stock alert. Items with their own threshold keep it. */
function LowStockCard() {
  const toast = useToast();
  const { active } = useCompany();
  const [saved, setSaved] = useState(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active?.id) return;
    api("/api/settings/low-stock").then((r) => { setSaved(r.threshold); setValue(String(r.threshold)); }).catch(() => {});
  }, [active?.id]);

  async function save(e) {
    e.preventDefault();
    const n = Number(value);
    if (value.trim() === "" || !Number.isFinite(n) || n < 0) return toast({ type: "error", title: "Enter 0 or more" });
    setBusy(true);
    try {
      const r = await api("/api/settings/low-stock", { method: "PUT", body: JSON.stringify({ threshold: n }) });
      setSaved(r.threshold);
      setValue(String(r.threshold));
      toast({ type: "success", title: "Low stock threshold saved" });
    } catch (err) {
      toast({ type: "error", title: "Could not save", message: err.message });
    } finally { setBusy(false); }
  }

  return (
    <Section icon={AlertTriangle} title="Low stock alert" hint="An item is low when its stock is at or below its alert level. Items with no threshold of their own use this value.">
      <p className="text-sm">
        Current default: {saved > 0 ? <b>{saved} units</b> : <b className="text-muted-foreground">off (no default alert)</b>}
      </p>
      <form onSubmit={save} className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          <span className="block text-muted-foreground mb-1">Default level (units)</span>
          <Input type="number" min="0" step="any" className="w-40" value={value} onChange={(e) => setValue(e.target.value)} aria-describedby="low-stock-help" />
        </label>
        <Button type="submit" size="sm" disabled={busy || value === String(saved ?? "")}>{busy ? "Saving…" : "Save"}</Button>
      </form>
      <p id="low-stock-help" className="text-xs text-muted-foreground">Set 0 to turn the default alert off. Per-item thresholds in Inventory still apply.</p>
    </Section>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const { active } = useCompany();
  if (!active) return <NoCompanySelected />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={Building2} title="Company details" hint={`Name, GSTIN, PAN, address, contacts, logo and bank details of ${active.name}.`}>
          <div className="flex flex-wrap gap-2">
            <Link href="/settings/company"><Button size="sm">Edit company details</Button></Link>
            <Link href="/companies"><Button size="sm" variant="outline">All companies</Button></Link>
          </div>
        </Section>
        <Section icon={FileText} title="Invoice templates" hint="Choose what each document shows and what each part is called. Each has its own live preview.">
          <div className="flex flex-wrap gap-2">
            <Link href="/settings/invoice-template?type=invoice"><Button size="sm" variant="outline">Tax invoice template</Button></Link>
            <Link href="/settings/invoice-template?type=quotation"><Button size="sm" variant="outline">Quotation template</Button></Link>
          </div>
        </Section>
        <LowStockCard />
        <TermsEditor />
        <BackupCard />
        <GeminiKey />
        <RecoveryCode />
        <ProductNames />
        <UpdateCard />
        <ResetCard />
      </div>
    </div>
  );
}
