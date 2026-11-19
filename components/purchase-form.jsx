"use client";
import { useMemo, useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { computeInvoice, gstStateFromGstin, GST_SLABS, GST_UNITS, isGstCompany } from "@/lib/gst";
import { formatINR, localDate } from "@/lib/utils";
import { useCompany, api } from "./company-context";
import { ItemSearch } from "./item-search";
import { MASTER_CREATED } from "./quick-create";

const blankItem = () => ({
  name: "", sku: "", hsnCode: "", quantity: 1, unit: "PCS",
  purchasePrice: 0, gstRate: 18, discount: 0
});

export function PurchaseForm({ initial = {}, onSubmit, submitLabel = "Save purchase" }) {
  const { active } = useCompany();
  const gstOn = isGstCompany(active);
  const gridCols = gstOn
    ? "grid [&>*]:min-w-0 grid-cols-[2fr_0.8fr_0.6fr_0.5fr_0.6fr_0.9fr_0.6fr_0.6fr_1fr_2.4rem]"
    : "grid [&>*]:min-w-0 grid-cols-[2fr_0.8fr_0.6fr_0.5fr_0.6fr_0.9fr_0.6fr_1fr_2.4rem]";
  const [supplierName, setSupplierName] = useState(initial.supplierName || "");
  const [supplierGst, setSupplierGst] = useState(initial.supplierGst || "");
  const [billNumber, setBillNumber] = useState(initial.billNumber || "");
  const [billDate, setBillDate] = useState(initial.billDate || localDate());
  const [items, setItems] = useState(initial.items?.length ? initial.items : [blankItem()]);
  const [amountPaid, setAmountPaid] = useState(initial.amountPaid || 0);
  const [notes, setNotes] = useState(initial.notes || "");
  const [autoCreate, setAutoCreate] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [customerId, setCustomerId] = useState(initial.customerId || "");

  useEffect(() => {
    if (active?.id) {
      api("/api/customers").then(setCustomers).catch(() => setCustomers([]));
      api("/api/inventory").then(setInventory).catch(() => setInventory([]));
    }
  }, [active?.id]);

  useEffect(() => {
    const added = (e) => { if (e.detail.kind === "item") setInventory((l) => [...l, e.detail.record]); };
    window.addEventListener(MASTER_CREATED, added);
    return () => window.removeEventListener(MASTER_CREATED, added);
  }, []);

  useEffect(() => {
    if (initial.items?.length) setItems(initial.items);
  }, [initial.items]);

  const supplierStateCode = gstStateFromGstin(supplierGst);
  const recipientStateCode = active?.stateCode || gstStateFromGstin(active?.gstNumber);
  // Without a GSTIN no GST is claimed: every line is priced at 0%, the same rule the server applies.
  const computed = useMemo(() => computeInvoice({
    items: items.map((i) => ({ ...i, sellingPrice: Number(i.purchasePrice) || 0, gstRate: gstOn ? i.gstRate : 0 })),
    supplierStateCode, recipientStateCode
  }), [items, supplierStateCode, recipientStateCode, gstOn]);

  function setItem(i, patch) {
    setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }

  async function save() {
    setSaving(true);
    try {
      await onSubmit({
        supplierName, supplierGst, billNumber, billDate,
        items, amountPaid: Number(amountPaid) || 0, notes,
        autoCreateInventory: autoCreate,
        customerId
      });
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Supplier & bill</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Billed To (Customer / Builder)">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">-- None (Company Expense) --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <div className="md:col-span-1 hidden" /> {/* spacer for layout */}
          <Field label="Supplier name *"><Input required value={supplierName} onChange={(e) => setSupplierName(e.target.value)} /></Field>
          <Field label="Supplier GSTIN"><Input value={supplierGst} onChange={(e) => setSupplierGst(e.target.value.toUpperCase())} /></Field>
          <Field label="Bill number"><Input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} /></Field>
          <Field label="Bill date"><Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Items</CardTitle>
          <Button data-add-row size="sm" variant="outline" onClick={() => setItems((a) => [...a, blankItem()])}>
            <Plus className="h-3.5 w-3.5" /> Add row
          </Button>
        </CardHeader>
        <CardContent className="space-y-2" data-grid>
          <datalist id="gst-unit-list-purchase">
            {GST_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <div className={`${gridCols} gap-2 text-xs text-muted-foreground px-2`}>
            <div>Item</div><div>HSN</div><div>SKU</div><div>Qty</div><div>Unit</div><div>Buy</div>{gstOn && <div>GST%</div>}<div>Disc</div><div className="text-right">Total</div><div />
          </div>
          {items.map((it, i) => (
            <div key={i} data-grid-row className={`${gridCols} gap-2 items-start`}>
              <ItemSearch
                value={it.name}
                items={inventory}
                onText={(name) => setItem(i, { name })}
                onPick={(inv) => setItem(i, {
                  name: inv.name, sku: inv.sku || "", hsnCode: inv.hsnCode || "", unit: inv.unit || "PCS",
                  gstRate: Number(inv.gstRate) || 0, purchasePrice: Number(inv.purchasePrice) || 0
                })}
              />
              <Input value={it.hsnCode} onChange={(e) => setItem(i, { hsnCode: e.target.value })} />
              <Input value={it.sku} onChange={(e) => setItem(i, { sku: e.target.value })} />
              <Input type="number" min={0} step="0.01" value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} />
              <Input
                list="gst-unit-list-purchase"
                placeholder="Unit"
                value={it.unit ?? ""}
                onChange={(e) => setItem(i, { unit: e.target.value.toUpperCase() })}
              />
              <Input type="number" min={0} step="0.01" value={it.purchasePrice} onChange={(e) => setItem(i, { purchasePrice: Number(e.target.value) })} />
              {gstOn && (
                <Select value={it.gstRate} onChange={(e) => setItem(i, { gstRate: Number(e.target.value) })}>
                  {GST_SLABS.map((r) => <option key={r} value={r}>{r}%</option>)}
                </Select>
              )}
              <Input type="number" min={0} step="0.01" value={it.discount} onChange={(e) => setItem(i, { discount: Number(e.target.value) })} />
              <div className="text-right pt-2 text-sm">{formatINR(computed.items[i]?.total || 0)}</div>
              <Button variant="ghost" size="icon" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoCreate} onChange={(e) => setAutoCreate(e.target.checked)} />
              Automatically add new items to inventory
            </label>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatINR(computed.subtotal)} />
            {gstOn && (computed.interstate
              ? <Row label="IGST" value={formatINR(computed.igst)} />
              : (<><Row label="CGST" value={formatINR(computed.cgst)} /><Row label="SGST" value={formatINR(computed.sgst)} /></>))}
            <div className="border-t pt-2">
              <Row label={<strong>Grand Total</strong>} value={<strong>{formatINR(computed.grandTotal)}</strong>} />
            </div>
            <Field label="Amount paid (₹)">
              <Input type="number" min={0} value={amountPaid} onChange={(e) => setAmountPaid(Number(e.target.value))} />
            </Field>
            <Button data-accept className="w-full" onClick={save} disabled={saving || !supplierName}>
              {saving ? "Saving…" : submitLabel}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
