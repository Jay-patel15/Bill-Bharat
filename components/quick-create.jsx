"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { api, useCompany } from "@/components/company-context";
import { GST_SLABS, gstStateFromGstin } from "@/lib/gst";
import { cn } from "@/lib/utils";

/** Fired after a quick create so open forms can add the new record to their lists. */
export const MASTER_CREATED = "bb:master-created";
export const OPEN_QUICK_CREATE = "bb:quick-create";

const BLANK = {
  customer: { name: "", phone: "", gstNumber: "", address: "" },
  item: { name: "", hsnCode: "", unit: "PCS", sellingPrice: "", gstRate: 18 }
};

/** Alt+C: create a customer or an item without leaving the current screen. */
export function QuickCreate() {
  const { active } = useCompany();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("customer");
  const [form, setForm] = useState(BLANK.customer);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const show = (e) => { const k = e.detail?.kind || "customer"; setKind(k); setForm({ ...BLANK[k], ...e.detail?.prefill }); setError(""); setOpen(true); };
    window.addEventListener(OPEN_QUICK_CREATE, show);
    return () => window.removeEventListener(OPEN_QUICK_CREATE, show);
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const switchKind = (k) => { setKind(k); setForm(BLANK[k]); setError(""); };

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const body = kind === "customer"
        ? { ...form, stateCode: gstStateFromGstin(form.gstNumber.trim()) || active?.stateCode || "" }
        : { ...form, sellingPrice: Number(form.sellingPrice) || 0, gstRate: Number(form.gstRate) };
      const record = await api(kind === "customer" ? "/api/customers" : "/api/inventory", { method: "POST", body: JSON.stringify({ ...body, companyId: active?.id }) });
      window.dispatchEvent(new CustomEvent(MASTER_CREATED, { detail: { kind, record } }));
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!active) return null;
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Quick create (Alt+C)">
      <div className="mb-3 flex gap-2" role="tablist">
        {["customer", "item"].map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => switchKind(k)}
            className={cn("rounded-md border px-3 py-1 text-sm capitalize", kind === k ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
            {k === "customer" ? "Customer / ledger" : "Item"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name"><Input required autoFocus value={form.name} onChange={set("name")} /></Field>
        {kind === "customer" ? (
          <>
            <Field label="GSTIN (optional)"><Input value={form.gstNumber} onChange={set("gstNumber")} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
            <Field label="Address"><Input value={form.address} onChange={set("address")} /></Field>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="HSN"><Input value={form.hsnCode} onChange={set("hsnCode")} /></Field>
            <Field label="Unit"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value.toUpperCase() })} /></Field>
            <Field label="Selling price"><Input type="number" min={0} step="0.01" value={form.sellingPrice} onChange={set("sellingPrice")} /></Field>
            <Field label="GST %">
              <Select value={form.gstRate} onChange={set("gstRate")}>{GST_SLABS.map((r) => <option key={r} value={r}>{r}%</option>)}</Select>
            </Field>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
