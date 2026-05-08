"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileDown, Eye, Plus, Trash2, Save, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BoqEditor, boqSubtotal } from "@/components/boq-editor";
import { ProgressBar } from "@/components/progress-bar";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";
import { formatINR, formatDate } from "@/lib/utils";

const statusVariant = {
  Active: "success", "On Hold": "warning", Completed: "secondary", Cancelled: "danger"
};

export default function ProjectDetailPage({ params }) {
  const router = useRouter();
  const toast = useToast();
  const { active } = useCompany();
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const summary = await api(`/api/projects/${params.id}/summary`);
      setData(summary);
      setDraft(summary.project);
    } catch (e) {
      toast({ type: "error", title: "Could not load", message: e.message });
      router.replace("/projects");
    }
  }

  useEffect(() => { if (active?.id) load(); }, [params.id, active?.id]);

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const { project, customer, contractValue, billed, collected, pending, remaining, overBilled, billedPercent, collectedPercent, invoices } = data;

  async function saveProject(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/api/projects/${params.id}`, { method: "PUT", body: JSON.stringify(draft) });
      toast({ type: "success", title: "Saved" });
      setEditing(false);
      await load();
    } catch (e) { toast({ type: "error", title: "Save failed", message: e.message }); }
    finally { setSaving(false); }
  }

  async function deleteProject() {
    if (!confirm(`Delete project "${project.name}"? Linked invoices will not be deleted.`)) return;
    try {
      await api(`/api/projects/${params.id}`, { method: "DELETE" });
      router.replace("/projects");
    } catch (e) { toast({ type: "error", title: "Delete failed", message: e.message }); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/projects"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold truncate">{project.name}</h1>
              <Badge variant={statusVariant[project.status] || "secondary"}>{project.status || "Active"}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {project.code ? `${project.code} · ` : ""}
              <Link href={`/customers/${customer?.id}`} className="hover:underline">{customer?.name || "—"}</Link>
              {project.startDate ? ` · started ${formatDate(project.startDate)}` : ""}
              {project.endDate ? ` · ends ${formatDate(project.endDate)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing((s) => !s)}>
            <Pencil className="h-4 w-4" /> {editing ? "Cancel" : "Edit"}
          </Button>
          <Link href={`/sales/create-invoice?customer=${customer?.id}&project=${project.id}`}>
            <Button><Plus className="h-4 w-4" /> Bill against project</Button>
          </Link>
          <Button variant="destructive" onClick={deleteProject}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid gap-3 md:grid-cols-5">
        <SummaryCard label="Contract" value={formatINR(contractValue)} primary />
        <SummaryCard label={`Billed (${billedPercent}%)`} value={formatINR(billed)} accent="text-sky-700" />
        <SummaryCard label={`Collected (${collectedPercent}%)`} value={formatINR(collected)} accent="text-emerald-600" />
        <SummaryCard label="Pending payment" value={formatINR(pending)} accent="text-amber-600" />
        <SummaryCard label="Remaining to bill" value={formatINR(remaining)} accent={overBilled ? "text-rose-600" : ""} />
      </div>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span>Progress against contract</span>
            <span className="text-muted-foreground">
              <span className="text-sky-700">{billedPercent}% billed</span> ·
              <span className="text-emerald-700 ml-1">{collectedPercent}% collected</span>
              {overBilled ? <span className="text-rose-600 ml-1">· {formatINR(overBilled)} over</span> : null}
            </span>
          </div>
          <ProgressBar billed={billedPercent} collected={collectedPercent} />
        </CardContent>
      </Card>

      {editing ? (
        <Card>
          <CardHeader><CardTitle>Edit project</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={saveProject} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Name *"><Input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
                <Field label="Code"><Input value={draft.code || ""} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} /></Field>
                <Field label="Status">
                  <Select value={draft.status || "Active"} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                    <option>Active</option><option>On Hold</option><option>Completed</option><option>Cancelled</option>
                  </Select>
                </Field>
                <Field label="Contract value">
                  <Input type="number" min={0} value={draft.contractValue || 0} onChange={(e) => setDraft({ ...draft, contractValue: Number(e.target.value) })} />
                </Field>
                <Field label="Start date"><Input type="date" value={draft.startDate || ""} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></Field>
                <Field label="End date"><Input type="date" value={draft.endDate || ""} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} /></Field>
                <div className="md:col-span-2">
                  <Field label="Description"><Textarea rows={2} value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Notes"><Textarea rows={2} value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="font-medium mb-2">BOQ items</div>
                <BoqEditor value={Array.isArray(draft.boqItems) ? draft.boqItems : []} onChange={(v) => setDraft({ ...draft, boqItems: v })} />
                <div className="flex justify-between text-sm pt-3">
                  <span className="text-muted-foreground">BOQ subtotal (pre-tax): {formatINR(boqSubtotal(draft.boqItems))}</span>
                  <Button type="submit" disabled={saving}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}</Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Bill of Quantities ({(project.boqItems || []).length})</CardTitle></CardHeader>
          <CardContent>
            {(project.boqItems || []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No BOQ rows. Click Edit to add scope items.</div>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Item</TH><TH>HSN</TH>
                    <TH className="text-right">Qty</TH><TH>Unit</TH>
                    <TH className="text-right">Rate</TH><TH className="text-right">GST%</TH>
                    <TH className="text-right">Amount</TH>
                  </TR>
                </THead>
                <TBody>
                  {(project.boqItems || []).map((it, i) => {
                    const amt = (Number(it.quantity) || 0) * (Number(it.rate) || 0);
                    return (
                      <TR key={i}>
                        <TD>
                          <div className="font-medium">{it.name}</div>
                          {it.description ? <div className="text-xs text-muted-foreground">{it.description}</div> : null}
                        </TD>
                        <TD>{it.hsnCode || "—"}</TD>
                        <TD className="text-right">{it.quantity}</TD>
                        <TD>{it.unit || "—"}</TD>
                        <TD className="text-right">{formatINR(it.rate)}</TD>
                        <TD className="text-right">{it.gstRate}%</TD>
                        <TD className="text-right font-medium">{formatINR(amt)}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Invoices for this project ({invoices.length})</CardTitle>
          <Link href={`/sales/create-invoice?customer=${customer?.id}&project=${project.id}`}>
            <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /> New invoice</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4">
              No invoices billed against this project yet.
            </div>
          ) : (
            <Table>
              <THead><TR>
                <TH>Number</TH><TH>Type</TH><TH>Date</TH>
                <TH className="text-right">Total</TH><TH className="text-right">Paid</TH>
                <TH>Status</TH><TH />
              </TR></THead>
              <TBody>
                {invoices.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium">{s.invoiceNumber}</TD>
                    <TD><Badge variant="outline">{s.documentType || "Tax Invoice"}</Badge></TD>
                    <TD>{formatDate(s.invoiceDate)}</TD>
                    <TD className="text-right font-semibold">{formatINR(s.total)}</TD>
                    <TD className="text-right">{formatINR(s.amountPaid)}</TD>
                    <TD><StatusBadge status={s.status} /></TD>
                    <TD className="text-right space-x-1">
                      <Link href={`/sales/${s.id}`}><Button size="sm" variant="outline"><Eye className="h-3.5 w-3.5" /></Button></Link>
                      <a href={`/api/sales/${s.id}/pdf`} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline"><FileDown className="h-3.5 w-3.5" /></Button>
                      </a>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, primary, accent }) {
  return (
    <Card>
      <CardContent className={`p-4 ${primary ? "bg-primary text-primary-foreground" : ""}`}>
        <div className={`text-[11px] uppercase tracking-wide ${primary ? "opacity-80" : "text-muted-foreground"}`}>{label}</div>
        <div className={`text-lg font-semibold mt-1 ${accent || ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
