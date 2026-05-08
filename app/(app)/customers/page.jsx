"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";
import { formatINR, STATES } from "@/lib/utils";
import { NoCompanySelected } from "@/components/empty-state";

const empty = {
  name: "", phone: "", email: "", address: "", state: "", stateCode: "",
  gstNumber: "", creditLimit: 0
};

export default function CustomersPage() {
  const { active } = useCompany();
  const toast = useToast();
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!active?.id) { setList([]); return; }
    try {
      const data = await api("/api/customers");
      setList(data || []);
    } catch {
      setList([]);
    }
  }

  useEffect(() => { load(); }, [active?.id]);

  if (!active) return <NoCompanySelected />;

  function startEdit(c) {
    setForm({ ...empty, ...c });
    setOpen(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (form.id) {
        await api(`/api/customers/${form.id}`, { method: "PUT", body: JSON.stringify(form) });
        toast({ type: "success", title: "Customer updated" });
      } else {
        await api("/api/customers", { method: "POST", body: JSON.stringify(form) });
        toast({ type: "success", title: "Customer added" });
      }
      setOpen(false);
      setForm(empty);
      await load();
    } catch (e) {
      toast({ type: "error", title: "Save failed", message: e.message });
    } finally { setLoading(false); }
  }

  async function onDelete(c) {
    if (!confirm(`Delete customer "${c.name}"?`)) return;
    try {
      await api(`/api/customers/${c.id}`, { method: "DELETE" });
      await load();
    } catch (e) { toast({ type: "error", title: "Delete failed", message: e.message }); }
  }

  const filtered = list.filter((c) =>
    [c.name, c.email, c.phone, c.gstNumber].some((f) => (f || "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">Track parties, GST details and outstanding balances.</p>
        </div>
        <Button onClick={() => { setForm(empty); setOpen(true); }}><Plus className="h-4 w-4" /> New customer</Button>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>All customers ({filtered.length})</CardTitle>
          <Input placeholder="Search name, phone, GSTIN…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4">No customers found.</div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH><TH>Phone</TH><TH>Email</TH><TH>GSTIN</TH>
                  <TH className="text-right">Outstanding</TH><TH /></TR>
              </THead>
              <TBody>
                {filtered.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">
                      <Link href={`/customers/${c.id}`} className="hover:underline">{c.name}</Link>
                    </TD>
                    <TD>{c.phone || "—"}</TD>
                    <TD>{c.email || "—"}</TD>
                    <TD>{c.gstNumber || "—"}</TD>
                    <TD className="text-right">{formatINR(c.outstanding)}</TD>
                    <TD className="text-right space-x-1">
                      <Link href={`/customers/${c.id}`} title="View bills">
                        <Button size="sm" variant="outline"><FileText className="h-3.5 w-3.5" /></Button>
                      </Link>
                      <Button size="sm" variant="outline" onClick={() => startEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title={form.id ? "Edit customer" : "Add customer"} size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button form="customer-form" type="submit" disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
          </>
        }>
        <form id="customer-form" onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <Field label="Name *"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="GSTIN">
            <Input value={form.gstNumber} onChange={(e) => {
              const v = e.target.value.toUpperCase();
              setForm({ ...form, gstNumber: v, stateCode: v.length >= 2 ? v.substring(0, 2) : form.stateCode });
            }} />
          </Field>
          <Field label="State">
            <Select value={form.stateCode} onChange={(e) => {
              const code = e.target.value;
              const s = STATES.find(([c]) => c === code);
              setForm({ ...form, stateCode: code, state: s ? s[1] : "" });
            }}>
              <option value="">—</option>
              {STATES.map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
            </Select>
          </Field>
          <Field label="Credit limit (₹)">
            <Input type="number" min={0} value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Address">
              <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
