"use client";
import { useEffect, useState, useMemo } from "react";
import { Plus, Pencil, Trash2, GitMerge, Download, AlertTriangle, CheckCircle2, X } from "lucide-react";
import * as XLSX from "xlsx";
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

// ─── Similarity helpers ───────────────────────────────────────────────────────
// Extract meaningful tokens from a product name.
// Ignores filler words; keeps numbers, sizes, product-type keywords.
const STOP_WORDS = new Set([
  "pvc", "isi", "make", "brand", "type", "the", "and", "for",
  "with", "new", "box", "of", "in", "a", "an", "by", "to"
]);

function tokenize(name = "") {
  return name
    .toUpperCase()
    .replace(/[.\-\/\\]/g, " ")      // treat . - / \ as spaces
    .split(/\s+/)
    .map((t) => t.replace(/[^A-Z0-9]/g, ""))
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t.toLowerCase()));
}

function similarity(a, b) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  // Jaccard-like: common / union
  const union = ta.size + tb.size - common;
  return common / union;
}

// Returns groups of items that are suspected duplicates (similarity >= threshold)
const SIMILARITY_THRESHOLD = 0.40;

function findDuplicateGroups(items) {
  const visited = new Set();
  const groups = [];

  for (let i = 0; i < items.length; i++) {
    if (visited.has(items[i].id)) continue;
    const group = [items[i]];
    for (let j = i + 1; j < items.length; j++) {
      if (visited.has(items[j].id)) continue;
      const score = similarity(items[i].name, items[j].name);
      if (score >= SIMILARITY_THRESHOLD) {
        // Also check same HSN if both have it — boosts confidence
        const sameHsn = items[i].hsnCode && items[j].hsnCode && items[i].hsnCode === items[j].hsnCode;
        if (score >= 0.55 || sameHsn) {
          group.push({ ...items[j], _score: Math.round(score * 100) });
          visited.add(items[j].id);
        }
      }
    }
    if (group.length > 1) {
      visited.add(items[i].id);
      groups.push(group);
    }
  }
  return groups;
}
// ─────────────────────────────────────────────────────────────────────────────

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

  // Duplicate finder state
  const [dupOpen, setDupOpen] = useState(false);
  const [masterChoice, setMasterChoice] = useState({});   // groupIndex → itemId
  const [merging, setMerging] = useState(null);            // groupIndex being merged

  async function load() {
    if (!active?.id) { setList([]); return; }
    try { setList(await api("/api/inventory") || []); }
    catch { setList([]); }
  }
  useEffect(() => { load(); }, [active?.id]);

  if (!active) return <NoCompanySelected />;

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

  async function onDelete(item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try { await api(`/api/inventory/${item.id}`, { method: "DELETE" }); await load(); }
    catch (e) { toast({ type: "error", title: "Delete failed", message: e.message }); }
  }

  // ── Duplicate merge ───────────────────────────────────────────────────────
  const dupGroups = useMemo(() => findDuplicateGroups(list), [list]);

  async function handleMerge(groupIndex) {
    const group = dupGroups[groupIndex];
    const masterId = masterChoice[groupIndex] || group[0].id;
    const duplicates = group.filter((it) => it.id !== masterId);

    setMerging(groupIndex);
    try {
      for (const dup of duplicates) {
        await api("/api/inventory/merge", {
          method: "POST",
          body: JSON.stringify({ masterId, duplicateId: dup.id })
        });
      }
      toast({ type: "success", title: "Items merged", message: `${duplicates.length} duplicate(s) merged into master.` });
      await load();
      setDupOpen(false);
    } catch (e) {
      toast({ type: "error", title: "Merge failed", message: e.message });
    } finally {
      setMerging(null);
    }
  }

  // ── Stock Report Download (Excel) ─────────────────────────────────────────
  function downloadStockReport() {
    const rows = list.map((it) => ({
      "Name":               it.name,
      "SKU":                it.sku || "",
      "Category":           it.category || "",
      "HSN Code":           it.hsnCode || "",
      "Unit":               it.unit || "",
      "GST %":              Number(it.gstRate || 0),
      "Purchase Price (₹)": Number(it.purchasePrice || 0),
      "Selling Price (₹)":  Number(it.sellingPrice || 0),
      "Qty in Stock":       Number(it.quantity || 0),
      "Low Stock Alert":    Number(it.lowStockThreshold || 0),
      "Stock Value (₹)":    Number(it.quantity || 0) * Number(it.purchasePrice || 0),
      "Status":             Number(it.quantity) <= Number(it.lowStockThreshold) && Number(it.lowStockThreshold) > 0
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
    XLSX.writeFile(wb, `stock-report-${active.name.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ type: "success", title: "Stock report downloaded!" });
  }

  const filtered = list.filter((it) =>
    [it.name, it.sku, it.category, it.hsnCode].some((f) => (f || "").toLowerCase().includes(search.toLowerCase()))
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
          {dupGroups.length > 0 && (
            <Button variant="outline" onClick={() => setDupOpen(true)} className="border-amber-400 text-amber-600 hover:bg-amber-50">
              <AlertTriangle className="h-4 w-4 mr-1" />
              {dupGroups.length} Possible Duplicate{dupGroups.length > 1 ? "s" : ""}
            </Button>
          )}
          <Button variant="outline" onClick={downloadStockReport}>
            <Download className="h-4 w-4 mr-1" /> Stock Report
          </Button>
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
                  <TH>Name</TH><TH>SKU</TH><TH>HSN</TH><TH>GST</TH>
                  <TH className="text-right">Buy</TH>
                  <TH className="text-right">Sell</TH>
                  <TH className="text-right">Stock</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {filtered.map((it) => {
                  const low = Number(it.quantity) <= Number(it.lowStockThreshold) && Number(it.lowStockThreshold) > 0;
                  return (
                    <TR key={it.id}>
                      <TD className="font-medium">
                        {it.name}
                        {it.category ? <span className="ml-2 text-xs text-muted-foreground">{it.category}</span> : null}
                      </TD>
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

      {/* ── Add / Edit Product Dialog ── */}
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

      {/* ── Duplicate Finder Dialog ── */}
      <Dialog open={dupOpen} onClose={() => setDupOpen(false)} title="Smart Duplicate Finder" size="xl">
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            The system found <strong>{dupGroups.length}</strong> group{dupGroups.length > 1 ? "s" : ""} of products that appear to be the same item but saved under different supplier names.
            Select the <strong>master record</strong> to keep, then click <strong>Merge</strong> — the other item's stock quantity will be added to the master and the duplicate will be deleted.
          </p>

          {dupGroups.map((group, gi) => {
            const currentMaster = masterChoice[gi] || group[0].id;
            const isMergingThis = merging === gi;

            return (
              <div key={gi} className="border rounded-lg overflow-hidden">
                {/* Group header */}
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Group {gi + 1} — {group.length} similar items
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleMerge(gi)}
                    disabled={isMergingThis}
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    <GitMerge className="h-3.5 w-3.5 mr-1" />
                    {isMergingThis ? "Merging…" : "Merge Group"}
                  </Button>
                </div>

                {/* Items in group */}
                <div className="divide-y">
                  {group.map((item) => {
                    const isMaster = currentMaster === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors ${isMaster ? "bg-emerald-50" : "hover:bg-muted/40"}`}
                        onClick={() => setMasterChoice((prev) => ({ ...prev, [gi]: item.id }))}
                      >
                        {/* Radio indicator */}
                        <div className={`mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${isMaster ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground"}`}>
                          {isMaster && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{item.name}</span>
                            {isMaster && <Badge variant="success" className="text-xs">Master (keep this)</Badge>}
                            {item._score && <Badge variant="secondary" className="text-xs">{item._score}% match</Badge>}
                          </div>
                          <div className="flex gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                            {item.hsnCode && <span>HSN: {item.hsnCode}</span>}
                            {item.sku     && <span>SKU: {item.sku}</span>}
                            <span>Stock: <strong>{item.quantity} {item.unit}</strong></span>
                            <span>Buy: {formatINR(item.purchasePrice)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* What will happen */}
                <div className="bg-muted/30 border-t px-4 py-2 text-xs text-muted-foreground">
                  After merge: master stock = {group.reduce((s, it) => s + Number(it.quantity || 0), 0)} {group[0].unit} &nbsp;·&nbsp;
                  {group.length - 1} duplicate(s) will be permanently deleted.
                </div>
              </div>
            );
          })}

          {dupGroups.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <p>No duplicate products found. Your inventory looks clean!</p>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
