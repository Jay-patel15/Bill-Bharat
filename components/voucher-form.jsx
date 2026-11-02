"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { api } from "@/components/company-context";
import { localDate, PAYMENT_MODES } from "@/lib/utils";

/**
 * One cash entry: IN (receipt, Debit), OUT (payment / expense, Credit) or
 * CONTRA (move money between cash and bank). Used by Rojmel and the expense
 * manager. `heads` are suggestions for the "from / for" field.
 */
export function VoucherForm({ direction, heads = [], onSaved, onCancel, compact = false }) {
  const isContra = direction === "CONTRA";
  const blank = { date: localDate(), head: isContra ? "Bank Transfer" : "", amount: "", mode: "Cash", description: "" };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const listId = `heads-${direction}`;

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const saved = await api("/api/vouchers", { method: "POST", body: JSON.stringify({ ...form, direction }) });
      setForm({ ...blank, date: form.date, mode: form.mode });
      onSaved?.(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const isIn = direction === "IN";
  return (
    <form onSubmit={submit} className={compact ? "grid gap-2 sm:grid-cols-6 items-end" : "space-y-3"}>
      <Field label="Date">
        <Input type="date" required value={form.date} onChange={set("date")} />
      </Field>
      <div className={compact ? "sm:col-span-2" : ""}>
        {isContra ? (
          <Field label="To account">
            <Select autoFocus value={form.head} onChange={set("head")}>
              {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
            </Select>
          </Field>
        ) : (
        <Field label={isIn ? "Received from" : "Paid for"}>
          <Input required autoFocus list={listId} maxLength={120} value={form.head} onChange={set("head")}
            placeholder={isIn ? "e.g. Ramesh Traders, Owner capital" : "e.g. Labour / Wages"} />
          <datalist id={listId}>{heads.map((h) => <option key={h} value={h} />)}</datalist>
        </Field>
        )}
      </div>
      <Field label="Amount (₹)">
        <Input type="number" required min="0.01" step="0.01" value={form.amount} onChange={set("amount")} />
      </Field>
      <Field label={isContra ? "From account" : "Mode"}>
        <Select value={form.mode} onChange={set("mode")}>
          {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
        </Select>
      </Field>
      <div className={compact ? "sm:col-span-5" : ""}>
        <Field label="Note (optional)">
          <Input maxLength={300} value={form.description} onChange={set("description")} />
        </Field>
      </div>
      <div className="flex gap-2 justify-end">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : isContra ? "Save Contra" : isIn ? "Save Receipt" : "Save Payment"}</Button>
      </div>
      {error && <p className="text-sm text-destructive sm:col-span-6">{error}</p>}
    </form>
  );
}
