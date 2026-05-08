"use client";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";
import { formatINR } from "@/lib/utils";
import { GST_SLABS } from "@/lib/gst";
import { NoCompanySelected } from "@/components/empty-state";

const empty = {
  name: "", sku: "", category: "", purchasePrice: 0, sellingPrice: 0,
  gstRate: 18, quantity: 0, lowStockThreshold: 0, unit: "PCS", hsnCode: ""
};

export default function InventoryPage() {
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
      setList(await api("/api/inventory") || []);
    } catch {
      setList([]);
    }
  }
  useEffect(() => { load(); }, [active?.id]);

  if (!active) return <NoCompanySelected />;

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (form.id) {
        await api(`/api/inventory/${form.id}`, { method: "PUT", body: JSON.stringify(form) });
        toast({ type: "success", title: "Item updated" });
      } else {
        await api("/api/inventory", { method: "POST", body: JSON.stringify(form) });
        toast({ type: "success", title: "Item added" });
      }
      setOpen(false); setForm(empty); await load();
    } catch (e) { toast({ type: "error", title: "Save failed", message: e.message }); }
    finally { setLoading(false); }
  }

  async function onDelete(item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try { await api(`/api/inventory/${item.id}`, { method: "DELETE" }); await load(); }
    catch (e) { toast({ type: "error", title: "Delete failed", message: e.message }); }
  }

  const filtered = list.filter((it) =>
    [it.name, it.sku, it.category, it.hsnCode].some((f) => (f || "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground">Products with HSN, GST rate, stock and low-stock alerts.</p>
        </div>
        <Button onClick={() => { setForm(empty); setOpen(true); }}><Plus className="h-4 w-4" /> New product</Button>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Products ({filtered.length})</CardTitle>
          <Input placeholder="Search name, SKU, HSN…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4">No products yet.</div>
          ) : (
            <Table>
              <THead>
                <TR><TH>Name</TH><TH>SKU</TH><TH>HSN</TH><TH>GST</TH><TH className="text-right">Buy</TH>
                  <TH className="text-right">Sell</TH><TH className="text-right">Stock</TH><TH /></TR>
              </THead>
              <TBody>
                {filtered.map((it) => {
                  const low = Number(it.quantity) <= Number(it.lowStockThreshold) && Number(it.lowStockThreshold) > 0;
                  return (
                    <TR key={it.id}>
                      <TD className="font-medium">{it.name}{it.category ? <span className="ml-2 text-xs text-muted-foreground">{it.category}</span> : null}</TD>
                      <TD>{it.sku || "—"}</TD>
                      <TD>{it.hsnCode || "—"}</TD>
                      <TD>{it.gstRate}%</TD>
                      <TD className="text-right">{formatINR(it.purchasePrice)}</TD>
                      <TD className="text-right">{formatINR(it.sellingPrice)}</TD>
                      <TD className="text-right">
                        <span className={low ? "text-amber-600 font-semibold" : ""}>{it.quantity}</span>
                        {low ? <Badge variant="warning" className="ml-2">Low</Badge> : null}
                      </TD>
                      <TD className="text-right space-x-1">
                        <Button size="sm" variant="outline" onClick={() => { setForm({ ...empty, ...it }); setOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => onDelete(it)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title={form.id ? "Edit product" : "New product"} size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button form="inv-form" type="submit" disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
          </>
        }>
        <form id="inv-form" onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <Field label="Name *"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="SKU"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
          <Field label="HSN code"><Input value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} /></Field>
          <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>

          <Field label="Purchase price"><Input type="number" step="0.01" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} /></Field>
          <Field label="Selling price"><Input type="number" step="0.01" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} /></Field>
          <Field label="GST %">
            <Select value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })}>
              {GST_SLABS.map((r) => <option key={r} value={r}>{r}%</option>)}
            </Select>
          </Field>
          <Field label="Unit"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>

          <Field label="Quantity in stock">
            <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </Field>
          <Field label="Low stock threshold">
            <Input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })} />
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
