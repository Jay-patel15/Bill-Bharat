"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileDown, Plus, FolderKanban, Landmark, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";
import { formatINR, formatDate, diffDays, STATES, DOCUMENT_TYPES } from "@/lib/utils";

export default function CustomerDetailPage({ params }) {
  const router = useRouter();
  const toast = useToast();
  const { active } = useCompany();
  const [customer, setCustomer] = useState(null);
  const [sales, setSales] = useState([]);
  const [projects, setProjects] = useState([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  async function load() {
    try {
      const c = await api(`/api/customers/${params.id}`);
      setCustomer(c);
      const allSales = await api("/api/sales");
      setSales(allSales.filter((s) => s.customerId === params.id));
      
      const allProj = await api("/api/projects");
      setProjects(allProj.filter((p) => p.customerId === params.id));
    } catch (e) {
      toast({ type: "error", title: "Could not load", message: e.message });
      router.replace("/customers");
    }
  }
  useEffect(() => { if (active?.id) load(); }, [params.id, active?.id]);

  const filtered = useMemo(() => sales.filter((s) => {
    if (typeFilter !== "all" && (s.documentType || "Tax Invoice") !== typeFilter) return false;
    return [s.invoiceNumber, s.status, s.documentType].some((f) => (f || "").toLowerCase().includes(search.toLowerCase()));
  }), [sales, search, typeFilter]);

  const stats = useMemo(() => {
    const taxInvoices = sales.filter((s) => (s.documentType || "Tax Invoice") === "Tax Invoice");
    const billed = taxInvoices.reduce((t, s) => t + Number(s.total || 0), 0);
    const paid = taxInvoices.reduce((t, s) => t + Number(s.amountPaid || 0), 0);
    return {
      totalDocs: sales.length,
      billed,
      paid,
      outstanding: Math.max(0, billed - paid)
    };
  }, [sales]);

  // Group billing and collection by site/project
  const siteSummaries = useMemo(() => {
    const map = new Map();
    // Initialize with existing projects
    projects.forEach((p) => {
      map.set(p.id, {
        id: p.id,
        name: p.name,
        code: p.code,
        contractValue: Number(p.contractValue || 0),
        billed: 0,
        paid: 0,
        pending: 0
      });
    });

    sales.forEach((s) => {
      if ((s.documentType || "Tax Invoice") !== "Tax Invoice") return;
      const pid = s.projectId || "general";
      if (!map.has(pid)) {
        map.set(pid, {
          id: pid,
          name: pid === "general" ? "General Billing (No Site Tagged)" : "Site Billing",
          code: "",
          contractValue: 0,
          billed: 0,
          paid: 0,
          pending: 0
        });
      }
      const entry = map.get(pid);
      entry.billed += Number(s.total || 0);
      entry.paid += Number(s.amountPaid || 0);
    });

    map.forEach((entry) => {
      entry.pending = Math.max(0, entry.billed - entry.paid);
    });

    return Array.from(map.values());
  }, [sales, projects]);

  if (!customer) return <div className="text-sm text-muted-foreground">Loading…</div>;

  async function saveEdits(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/api/customers/${params.id}`, { method: "PUT", body: JSON.stringify(customer) });
      toast({ type: "success", title: "Saved" });
      setEditing(false);
      await load();
    } catch (e) { toast({ type: "error", title: "Save failed", message: e.message }); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/customers"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-2xl font-semibold">{customer.name}</h1>
            <p className="text-sm text-muted-foreground">{customer.gstNumber || "No GSTIN"} · {customer.phone || customer.email || ""}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing((s) => !s)}>{editing ? "Cancel" : "Edit"}</Button>
          <Link href={`/sales/create-invoice?customer=${customer.id}`}>
            <Button><Plus className="h-4 w-4" /> New invoice</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Documents" value={stats.totalDocs} />
        <Stat label="Total billed" value={formatINR(stats.billed)} />
        <Stat label="Collected" value={formatINR(stats.paid)} accent="text-emerald-600" />
        <Stat label="Outstanding" value={formatINR(customer.outstanding || stats.outstanding)} accent="text-amber-600" />
      </div>

      {/* Site-Wise Billing & Collection Breakdown */}
      {siteSummaries.length > 0 && (
        <Card className="border-indigo-100 dark:border-indigo-950">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-indigo-600" /> Site-Wise Billing & Jama Summary ({siteSummaries.length})
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Breakdown of total invoices billed, money collected, and pending dues by construction site.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {siteSummaries.map((site) => (
                <div key={site.id} className="rounded-lg border p-3.5 space-y-2 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{site.name}</span>
                    {site.id !== "general" && (
                      <Link href={`/projects/${site.id}`}>
                        <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 hover:underline">View Passbook →</Badge>
                      </Link>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1 pt-1 text-xs">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Billed</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{formatINR(site.billed)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-emerald-700 uppercase font-medium">Collected</div>
                      <div className="font-semibold text-emerald-600">{formatINR(site.paid)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-rose-700 uppercase font-medium">Pending</div>
                      <div className="font-semibold text-rose-600">{formatINR(site.pending)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {editing ? (
        <Card>
          <CardHeader><CardTitle>Edit customer</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={saveEdits} className="grid gap-4 md:grid-cols-2">
              <Field label="Name *"><Input required value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></Field>
              <Field label="Phone"><Input value={customer.phone || ""} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></Field>
              <Field label="Email"><Input type="email" value={customer.email || ""} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} /></Field>
              <Field label="GSTIN">
                <Input value={customer.gstNumber || ""} onChange={(e) => {
                  const v = e.target.value.toUpperCase();
                  setCustomer({ ...customer, gstNumber: v, stateCode: v.length >= 2 ? v.substring(0, 2) : customer.stateCode });
                }} />
              </Field>
              <Field label="State">
                <Select value={customer.stateCode || ""} onChange={(e) => {
                  const code = e.target.value;
                  const s = STATES.find(([c]) => c === code);
                  setCustomer({ ...customer, stateCode: code, state: s ? s[1] : "" });
                }}>
                  <option value="">—</option>
                  {STATES.map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
                </Select>
              </Field>
              <Field label="Credit limit (₹)">
                <Input type="number" min={0} value={customer.creditLimit || 0} onChange={(e) => setCustomer({ ...customer, creditLimit: Number(e.target.value) })} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Address">
                  <Textarea rows={2} value={customer.address || ""} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />
                </Field>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Phone" value={customer.phone || "—"} />
              <Row label="Email" value={customer.email || "—"} />
              <Row label="Address" value={customer.address || "—"} />
              <Row label="State" value={`${customer.state || "—"}${customer.stateCode ? ` (${customer.stateCode})` : ""}`} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Tax</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="GSTIN" value={customer.gstNumber || "—"} />
              <Row label="Credit limit" value={formatINR(customer.creditLimit || 0)} />
              <Row label="Outstanding" value={formatINR(stats.outstanding)} />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle>Bills & documents ({filtered.length})</CardTitle>
          <div className="flex gap-2">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="max-w-[180px]">
              <option value="all">All types</option>
              {DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.value}</option>)}
            </Select>
            <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4">
              No documents yet for this customer.{" "}
              <Link href={`/sales/create-invoice?customer=${customer.id}`} className="text-primary underline">Create one →</Link>
            </div>
          ) : (
            <Table>
              <THead><TR>
                <TH>Number</TH><TH>Site / Project</TH><TH>Type</TH><TH>Date</TH>
                <TH className="text-right">Total</TH><TH className="text-right">Paid</TH>
                <TH className="text-center">Days</TH>
                <TH>Status</TH><TH />
              </TR></THead>
              <TBody>
                {filtered.map((s) => {
                  const proj = projects.find(p => p.id === s.projectId);
                  return (
                    <TR 
                      key={s.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors group"
                    >
                      <TD className="font-medium" onClick={() => router.push(`/sales/${s.id}`)}>{s.invoiceNumber}</TD>
                      <TD onClick={() => router.push(`/sales/${s.id}`)}>
                        {proj ? <Badge variant="secondary">{proj.name}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                      </TD>
                      <TD onClick={() => router.push(`/sales/${s.id}`)}><Badge variant="outline">{s.documentType || "Tax Invoice"}</Badge></TD>
                      <TD onClick={() => router.push(`/sales/${s.id}`)}>{formatDate(s.invoiceDate)}</TD>
                      <TD className="text-right font-semibold" onClick={() => router.push(`/sales/${s.id}`)}>{formatINR(s.total)}</TD>
                      <TD className="text-right" onClick={() => router.push(`/sales/${s.id}`)}>{formatINR(s.amountPaid)}</TD>
                      <TD className="text-center text-xs font-mono" onClick={() => router.push(`/sales/${s.id}`)}>
                        {(() => {
                          const days = s.status === "Paid" ? diffDays(s.invoiceDate, s.updatedAt) : diffDays(s.invoiceDate);
                          const color = s.status === "Paid" ? "text-muted-foreground" : days > 30 ? "text-destructive font-bold" : days > 15 ? "text-amber-600 font-semibold" : "text-muted-foreground";
                          return <span className={color}>{days} d</span>;
                        })()}
                      </TD>
                      <TD onClick={() => router.push(`/sales/${s.id}`)}><StatusBadge status={s.status} /></TD>
                      <TD className="text-right">
                        <a 
                          href={`/api/sales/${s.id}/pdf`} 
                          target="_blank" 
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Download Invoice PDF"
                        >
                          <Button size="sm" variant="outline" className="gap-1.5 px-4">
                            <FileDown className="h-3.5 w-3.5" />
                            <span>Download PDF</span>
                          </Button>
                        </a>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-xl font-semibold mt-1 ${accent || ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
function Row({ label, value }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
