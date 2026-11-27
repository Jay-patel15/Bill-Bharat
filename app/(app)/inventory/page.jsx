"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, GitMerge, Download, Upload, AlertTriangle, CheckCircle2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/input";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { VirtualTBody } from "@/components/ui/virtual-tbody";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";
import { formatINR, localDate } from "@/lib/utils";
import { GST_SLABS, GST_UNITS, isGstCompany } from "@/lib/gst";
import { alertLevel, isLowStock } from "@/lib/stock";
import { NoCompanySelected } from "@/components/empty-state";



const empty = {
  name: "", sku: "", barcode: "", category: "", purchasePrice: 0, sellingPrice: 0,
  gstRate: 18, quantity: 0, lowStockThreshold: 0, unit: "PCS", hsnCode: ""
};

export default function InventoryPage() {
  const { active } = useCompany();
  const gstOn = isGstCompany(active);
  const toast = useToast();
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  // Company default low-stock level from Settings (0 = off); items with their own threshold ignore it.
  const [lowDefault, setLowDefault] = useState(0);
  const fileInput = useRef(null);
  const [importResult, setImportResult] = useState(null); // { added, skipped } after a CSV import


  async function load() {
    if (!active?.id) { setList([]); return; }
    try {
      const [items, low] = await Promise.all([api("/api/inventory"), api("/api/settings/low-stock")]);
      setList(items || []);
      setLowDefault(Number(low?.threshold) || 0);
    }
    catch { setList([]); }
  }
  useEffect(() => { load(); }, [active?.id]);
  // F6 opens this page with ?new=<time>: show the new-item form straight away.
  const urlParams = useSearchParams();
  useEffect(() => { if (urlParams.get("new")) { setForm(empty); setOpen(true); } }, [urlParams.get("new")]);

  // The Electrical Works consumables line is an invoice item, not stock: keep it out of the list and report.
  const stock = list.filter((it) => !Number(it.consumables));
  const consumablesOn = list.some((it) => Number(it.consumables) === 1);

  async function toggleConsumables() {
    try {
      await api("/api/inventory/consumables", { method: "POST", body: JSON.stringify({ enabled: !consumablesOn }) });
      toast({ type: "success", title: consumablesOn ? "Electrical Works disabled" : "Electrical Works enabled" });
      await load();
    } catch (e) { toast({ type: "error", title: "Could not change setting", message: e.message }); }
  }

  // ── Add / Edit product ────────────────────────────────────────────────────
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

  // ── CSV import: the first sheet's header row names the columns; the server checks every row ──
  async function importCsv(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again still fires
    if (!file) return;
    try {
      const wb = XLSX.read(await file.text(), { type: "string" });
      // raw:false keeps the cell text, so codes such as 0123 keep their leading zero.
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
      const result = await api("/api/inventory/import", { method: "POST", body: JSON.stringify({ companyId: active.id, rows }) });
      setImportResult(result);
      await load();
    } catch (err) { toast({ type: "error", title: "Import failed", message: err.message }); }
  }

  async function onDelete(item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try { await api(`/api/inventory/${item.id}`, { method: "DELETE" }); await load(); }
    catch (e) { toast({ type: "error", title: "Delete failed", message: e.message }); }
  }



  // ── Stock Report Download (Excel) ─────────────────────────────────────────
  function downloadStockReport() {
    const rows = stock.map((it) => ({
      "Name":               it.name,
      "SKU":                it.sku || "",
      "Barcode":            it.barcode || "",
      "Category":           it.category || "",
      "HSN Code":           it.hsnCode || "",
      "Unit":               it.unit || "",
      "GST %":              Number(it.gstRate || 0),
      "Purchase Price (₹)": Number(it.purchasePrice || 0),
      "Selling Price (₹)":  Number(it.sellingPrice || 0),
      "Qty in Stock":       Number(it.quantity || 0),
      "Low Stock Alert":    alertLevel(it, lowDefault),
      "Stock Value (₹)":    Number(it.quantity || 0) * Number(it.purchasePrice || 0),
      "Status":             Number(it.quantity) < 0 ? "NEGATIVE STOCK"
                              : isLowStock(it, lowDefault)
                              ? "LOW STOCK" : "OK"
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto column widths
    const maxWidths = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...rows.map((r) => String(r[key] ?? "").length)) + 2
    }));
    ws["!cols"] = maxWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Report");
    XLSX.writeFile(wb, `stock-report-${active.name.replace(/\s+/g, "-")}-${localDate()}.xlsx`);
    toast({ type: "success", title: "Stock report downloaded!" });
  }

  const filtered = stock.filter((it) =>
    [it.name, it.sku, it.barcode, it.category, it.hsnCode].some((f) => (f || "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground">Products with HSN, GST rate, stock and low-stock alerts.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={toggleConsumables}>
            {consumablesOn ? "Disable Electrical Works consumables" : "Enable Electrical Works consumables"}
          </Button>
          <Button variant="outline" onClick={downloadStockReport}>
            <Download className="h-4 w-4 mr-1" /> Stock Report
          </Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()} title="CSV with a name column; sku, barcode, category, hsnCode, unit, purchasePrice, sellingPrice, gstRate, quantity, lowStockThreshold are optional">
            <Upload className="h-4 w-4 mr-1" /> Import CSV
          </Button>
          <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
          <Button onClick={() => { setForm(empty); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New product
          </Button>
        </div>
      </div>

      {/* Inventory table */}
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
                <TR>
                  <TH>Name</TH><TH>SKU</TH><TH className="hidden md:table-cell">HSN</TH><TH className="hidden md:table-cell">Unit</TH>{gstOn && <TH>GST</TH>}
                  <TH className="text-right">Buy</TH>
                  <TH className="text-right">Sell</TH>
                  <TH className="text-right">Stock</TH>
                  <TH />
                </TR>
              </THead>
              <VirtualTBody items={filtered} colSpan={9}>
                {(it) => {
                  const low = isLowStock(it, lowDefault);
                  const negative = Number(it.quantity) < 0;
                  return (
                    <TR key={it.id}>
                      <TD className="font-medium">
                        {it.name}
                        {it.category ? <span className="ml-2 text-xs text-muted-foreground">{it.category}</span> : null}
                      </TD>
                      <TD>{it.sku || "—"}</TD>
                      <TD className="hidden md:table-cell">{it.hsnCode || "—"}</TD>
                      <TD className="hidden md:table-cell"><Badge variant="outline">{it.unit || "PCS"}</Badge></TD>
                      {gstOn && <TD>{it.gstRate}%</TD>}
                      <TD className="text-right">{formatINR(it.purchasePrice)}</TD>
                      <TD className="text-right">{formatINR(it.sellingPrice)}</TD>
                      <TD className="text-right">
                        <span className={negative ? "text-red-600 font-semibold" : low ? "text-amber-600 font-semibold" : ""}>{it.quantity} {it.unit || "PCS"}</span>
                        {negative ? <Badge variant="danger" className="ml-2">Negative</Badge> : low ? <Badge variant="warning" className="ml-2">Low</Badge> : null}
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
                }}
              </VirtualTBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Add / Edit Product Dialog ── */}
      <Dialog open={!!importResult} onClose={() => setImportResult(null)} title="CSV import" size="md"
        footer={<Button onClick={() => setImportResult(null)}>OK</Button>}>
        {importResult && (
          <div className="space-y-3 text-sm">
            <p><strong>{importResult.added}</strong> product(s) added.{importResult.skipped.length ? <> <strong>{importResult.skipped.length}</strong> row(s) skipped and not added:</> : null}</p>
            {importResult.skipped.length > 0 && (
              <ul className="max-h-72 overflow-auto space-y-1 text-xs">
                {importResult.skipped.map((s) => (
                  <li key={s.line}>Line {s.line}{s.name ? ` "${s.name}"` : ""}: {s.reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={open} onClose={() => setOpen(false)} title={form.id ? "Edit product" : "New product"} size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button form="inv-form" type="submit" disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
          </>
        }>
        <datalist id="gst-unit-list-inv">
          {GST_UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <form id="inv-form" onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <Field label="Name *"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="SKU"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
          <Field label="Barcode"><Input value={form.barcode || ""} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></Field>
          <Field label="HSN code"><Input value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} /></Field>
          <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="Purchase price"><Input type="number" step="0.01" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} /></Field>
          <Field label="Selling price"><Input type="number" step="0.01" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} /></Field>
          {gstOn && (
            <Field label="GST %">
              <Select value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })}>
                {GST_SLABS.map((r) => <option key={r} value={r}>{r}%</option>)}
              </Select>
            </Field>
          )}
          <Field label="Unit">
            <Input
              list="gst-unit-list-inv"
              placeholder="e.g. PCS, NOS, KG, L"
              value={form.unit ?? ""}
              onChange={(e) => setForm({ ...form, unit: e.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="Quantity in stock">
            <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </Field>
          <Field label="Low stock threshold">
            <Input type="number" min="0" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })} />
            <p className="mt-1 text-xs text-muted-foreground">
              0 uses the company default{lowDefault > 0 ? ` (${lowDefault})` : " (off)"}, set in Settings.
            </p>
          </Field>
        </form>
      </Dialog>


    </div>
  );
}
