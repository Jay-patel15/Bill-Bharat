"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, FileText, KeyRound, ScrollText, Tags, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { api, useCompany } from "@/components/company-context";
import { NoCompanySelected } from "@/components/empty-state";
import { BackupCard, ResetCard } from "@/components/backup-card";

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
  const [list, setList] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

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
    } catch (err) { alert(err.message); }
    finally { setBusy(false); }
  }

  async function remove(id) {
    if (!confirm("Remove this product name?")) return;
    try {
      await api(`/api/product-mappings/${id}`, { method: "DELETE" });
      setList((prev) => prev.filter((m) => m.id !== id));
    } catch (err) { alert(err.message); }
  }

  return (
    <Section icon={Tags} title="Product master names" hint="One name per line. The AI reader matches supplier item names to these.">
      <form onSubmit={add} className="space-y-2">
        <Textarea rows={3} placeholder={"TMT Bar 12mm\nCement OPC 53"} value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" size="sm" disabled={busy || !text.trim()}>{busy ? "Adding…" : "Add names"}</Button>
      </form>
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

export default function SettingsPage() {
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
        <Section icon={FileText} title="Invoice template" hint="Choose what the GST invoice shows and what each part is called. Live preview.">
          <Link href="/settings/invoice-template"><Button size="sm" variant="outline">Edit invoice template</Button></Link>
        </Section>
        <TermsEditor />
        <BackupCard />
        <GeminiKey />
        <ProductNames />
        <ResetCard />
      </div>
    </div>
  );
}
