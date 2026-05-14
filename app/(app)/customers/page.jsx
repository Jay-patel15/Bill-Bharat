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
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!active?.id) { setList([]); setSales([]); setPurchases([]); return; }
    try {
      const [customersData, salesData, purchasesData] = await Promise.all([
        api("/api/customers").catch(() => []),
        api("/api/sales").catch(() => []),
        api("/api/purchases").catch(() => [])
      ]);
      setList(customersData || []);
      setSales(salesData || []);
      setPurchases(purchasesData || []);
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

  const totalGlobalBilled = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const totalGlobalReceived = sales.reduce((sum, s) => sum + Number(s.amountPaid || 0), 0);
  const totalGlobalInvested = purchases.reduce((sum, p) => sum + Number(p.total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Customers & Builders Dashboard</h1>
          <p className="text-sm text-muted-foreground">Track billing, payments, and investments per builder.</p>
        </div>
        <Button onClick={() => { setForm(empty); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New builder</Button>
      </div>

      {/* Global Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-xs text-blue-600 font-semibold mb-1 uppercase tracking-wider">Total Billed</p>
            <p className="text-2xl font-bold text-blue-900">{formatINR(totalGlobalBilled)}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-600 font-semibold mb-1 uppercase tracking-wider">Amount Received</p>
            <p className="text-2xl font-bold text-emerald-900">{formatINR(totalGlobalReceived)}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <p className="text-xs text-amber-600 font-semibold mb-1 uppercase tracking-wider">Total Cost Invested</p>
            <p className="text-2xl font-bold text-amber-900">{formatINR(totalGlobalInvested)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <h2 className="text-lg font-semibold text-foreground/80">Individual Builders ({filtered.length})</h2>
        <Input placeholder="Search name, phone, GSTIN…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs bg-background" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-sm text-muted-foreground p-8 text-center border border-dashed rounded-lg bg-card">
            No customers found.
          </div>
        ) : (
          filtered.map((c) => {
            const customerSales = sales.filter(s => s.customerId === c.id);
            const customerPurchases = purchases.filter(p => p.customerId === c.id);
            
            const billed = customerSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
            const received = customerSales.reduce((sum, s) => sum + Number(s.amountPaid || 0), 0);
            const invested = customerPurchases.reduce((sum, p) => sum + Number(p.total || 0), 0);

            return (
              <Link key={c.id} href={`/customers/${c.id}`} className="block group">
                <Card className="flex flex-col hover:border-primary/60 hover:shadow-md transition-all shadow-sm cursor-pointer">
                  <CardHeader className="p-4 pb-3 border-b bg-muted/10">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-base truncate group-hover:text-primary transition-colors">{c.name}</p>
                        <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                          {c.phone && <div className="truncate">📞 {c.phone}</div>}
                          {c.gstNumber && <div className="truncate">📝 {c.gstNumber}</div>}
                          {!c.phone && !c.gstNumber && <div className="italic">No contact info</div>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" onClick={(e) => { e.preventDefault(); startEdit(c); }} className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={(e) => { e.preventDefault(); onDelete(c); }} className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 flex-1 flex flex-col gap-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Billed</span>
                      <span className="font-medium text-foreground">{formatINR(billed)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Received</span>
                      <span className="font-medium text-emerald-600">{formatINR(received)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Invested</span>
                      <span className="font-medium text-amber-600">{formatINR(invested)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>

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
