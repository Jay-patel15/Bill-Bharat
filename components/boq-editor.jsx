"use client";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { GST_SLABS } from "@/lib/gst";
import { formatINR } from "@/lib/utils";

const blankRow = () => ({
  name: "", description: "", hsnCode: "", quantity: 1, unit: "PCS",
  rate: 0, gstRate: 18
});

/**
 * Inline editor for Bill of Quantities rows.
 * @param {Object} props
 * @param {Array} props.value      current rows
 * @param {Function} props.onChange (rows) => void
 */
export function BoqEditor({ value, onChange }) {
  const rows = value || [];

  function setRow(i, patch) {
    onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }
  function addRow() { onChange([...rows, blankRow()]); }
  function removeRow(i) { onChange(rows.filter((_, idx) => idx !== i)); }

  const subtotal = rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.rate) || 0), 0);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[2fr_0.7fr_0.6fr_0.7fr_1fr_0.7fr_1fr_2.4rem] gap-2 text-xs text-muted-foreground px-2">
        <div>Item / Scope</div>
        <div>HSN</div>
        <div>Qty</div>
        <div>Unit</div>
        <div>Rate</div>
        <div>GST%</div>
        <div className="text-right">Amount</div>
        <div />
      </div>
      {rows.length === 0 ? (
        <div className="border border-dashed rounded p-6 text-sm text-muted-foreground text-center">
          No BOQ rows yet — add the scope items that make up this project.
        </div>
      ) : null}
      {rows.map((r, i) => {
        const amount = (Number(r.quantity) || 0) * (Number(r.rate) || 0);
        return (
          <div key={i} className="grid grid-cols-[2fr_0.7fr_0.6fr_0.7fr_1fr_0.7fr_1fr_2.4rem] gap-2 items-start">
            <div className="space-y-1">
              <Input placeholder="Scope item" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} />
              <Input placeholder="Description (optional)" value={r.description || ""} onChange={(e) => setRow(i, { description: e.target.value })} />
            </div>
            <Input value={r.hsnCode || ""} onChange={(e) => setRow(i, { hsnCode: e.target.value })} />
            <Input type="number" min={0} step="0.01" value={r.quantity} onChange={(e) => setRow(i, { quantity: Number(e.target.value) })} />
            <Input value={r.unit || ""} onChange={(e) => setRow(i, { unit: e.target.value })} />
            <Input type="number" min={0} step="0.01" value={r.rate} onChange={(e) => setRow(i, { rate: Number(e.target.value) })} />
            <Select value={r.gstRate ?? 18} onChange={(e) => setRow(i, { gstRate: Number(e.target.value) })}>
              {GST_SLABS.map((g) => <option key={g} value={g}>{g}%</option>)}
            </Select>
            <div className="text-right pt-2 text-sm font-medium">{formatINR(amount)}</div>
            <Button variant="ghost" size="icon" onClick={() => removeRow(i)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-2">
        <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-3.5 w-3.5" /> Add row</Button>
        <div className="text-sm">
          BOQ subtotal: <span className="font-semibold">{formatINR(subtotal)}</span>
          <span className="text-xs text-muted-foreground ml-2">(before tax)</span>
        </div>
      </div>
    </div>
  );
}

export function boqSubtotal(rows) {
  return (rows || []).reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.rate) || 0), 0);
}
