"use client";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { formatINR, formatDate } from "@/lib/utils";
import { paymentState, excessOver } from "@/lib/payments";

const METHODS = ["Cash", "UPI", "NEFT", "RTGS", "Cheque", "Bank Transfer"];
const EMPTY = { amount: "", method: "Cash", ref: "", notes: "" };

/**
 * Payments on one sale or one purchase bill. The same screen on both.
 * All arithmetic comes from lib/payments.js; the server checks the same rules.
 *
 *   total          document total
 *   payments       the document's payment rows (newest first)
 *   onRecord(d)    d = {amount, method, notes, acceptExcess}; returns a promise
 *   onUpdate(p, d) edits payment p in place; d as above
 *   onDelete(id)   removes a payment
 *   canCloseBill   show "Close bill" (records the whole pending amount)
 *   startEditId   open this payment for editing once, e.g. from the customer page
 */
export function PaymentSection({ total, payments = [], onRecord, onUpdate, onDelete, canCloseBill = false, startEditId = null }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const started = useRef(false);

  const st = paymentState({ total, payments, editingId });
  const editing = st.editing;
  const amount = Number(form.amount) || 0;
  const over = excessOver(amount, st.room);

  // The payment being edited is gone (deleted, or the list was refreshed): leave edit mode.
  useEffect(() => {
    if (editingId && !editing) {
      cancel();
      toast({ type: "info", title: "Edit cancelled", message: "That payment no longer exists." });
    }
  }, [editingId, editing]);

  // Opened from another page: start editing that payment, once.
  useEffect(() => {
    if (started.current || !startEditId) return;
    const p = payments.find((x) => x.id === startEditId);
    if (p) { started.current = true; startEdit(p); }
  }, [startEditId, payments]);

  function startEdit(p) {
    setEditingId(p.id);
    setForm({ amount: String(Math.abs(Number(p.amount))), method: p.method || "Cash", ref: "", notes: p.notes || "" });
  }

  function cancel() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function record(value, acceptExcess) {
    setSaving(true);
    try {
      const notes = form.ref.trim() ? `${form.method} Ref: ${form.ref.trim()}` : undefined;
      await onRecord({ amount: value, method: form.method, notes, acceptExcess });
      toast({ type: "success", title: "Payment recorded" });
      cancel();
    } catch (e) {
      toast({ type: "error", title: "Payment failed", message: e.message });
    } finally { setSaving(false); }
  }

  async function save(acceptExcess = false) {
    if (!(amount > 0)) return toast({ type: "error", title: "Invalid amount", message: "Enter an amount greater than zero." });
    if (over > 0 && !acceptExcess) return;
    if (editing) {
      setSaving(true);
      try {
        await onUpdate(editing, { amount, method: form.method, notes: form.notes, acceptExcess });
        toast({ type: "success", title: "Payment updated" });
        cancel();
      } catch (e) {
        toast({ type: "error", title: "Failed to update payment", message: e.message });
      } finally { setSaving(false); }
      return;
    }
    await record(amount, acceptExcess);
  }

  async function closeBill() {
    if (st.pending <= 0) return;
    await record(st.pending, false);
  }

  async function remove(p) {
    if (!confirm("Delete this payment entry? The paid amount, status and ledger will be updated.")) return;
    try {
      await onDelete(p.id);
      if (editingId === p.id) cancel();
      toast({ type: "success", title: "Payment entry deleted" });
    } catch (e) {
      toast({ type: "error", title: "Failed to delete payment", message: e.message });
    }
  }

  const fullyPaid = st.pending <= 0 && !editing;
  const refField = !editing && form.method !== "Cash" && form.method !== "Bank Transfer";

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle>Update Payment & Receipts</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-lg border bg-slate-50 text-center">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase">Total</div>
            <div className="text-lg font-bold mt-1">{formatINR(total)}</div>
          </div>
          <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/50 text-center">
            <div className="text-[11px] font-semibold text-emerald-700 uppercase">Received</div>
            <div className="text-lg font-bold text-emerald-800 mt-1">{formatINR(st.paid)}</div>
          </div>
          <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/50 text-center">
            <div className="text-[11px] font-semibold text-rose-700 uppercase">Pending</div>
            <div className="text-lg font-bold text-rose-800 mt-1">{formatINR(st.pending)}</div>
          </div>
        </div>

        {editing && (
          <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded p-2 flex items-center justify-between gap-2">
            <span>Editing a payment of {formatINR(editing.amount)} ({editing.method || "Cash"}). Change the amount, method or notes, then save.</span>
            <button className="underline whitespace-nowrap" onClick={cancel}>Cancel edit</button>
          </div>
        )}

        {over > 0 && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded p-3 space-y-2">
            <div>
              ⚠️ <strong>{formatINR(amount)}</strong> is more than the {editing ? "amount still allowed" : "pending balance"} <strong>{formatINR(st.room)}</strong>:
              {" "}<strong>{formatINR(over)}</strong> extra. Re-edit the amount, or ignore and record it as it is.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => document.getElementById("pay-amount")?.select()}>Re-edit amount</Button>
              <Button size="sm" variant="outline" disabled={saving} onClick={() => save(true)}>Ignore and record anyway</Button>
            </div>
          </div>
        )}

        {fullyPaid ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3">
            Fully paid. To change it, edit or delete a payment below.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label={editing ? "Amount (₹)" : "Amount received now (₹)"}>
              <Input id="pay-amount" type="number" min="0" step="0.01"
                placeholder={editing ? "" : `Max ${formatINR(st.room)}`}
                value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Payment Method">
              <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value, ref: "" })}>
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </Field>
            {refField && (
              <Field label={form.method === "Cheque" ? "Cheque Number" : form.method === "UPI" ? "UPI Transaction ID" : "Transaction ID (NEFT/RTGS)"}>
                <Input value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })}
                  placeholder={form.method === "Cheque" ? "e.g. 004521" : form.method === "UPI" ? "e.g. UPI/123456789" : "e.g. NEFT123456789"} />
              </Field>
            )}
            {editing && (
              <div className="md:col-span-2">
                <Field label="Notes">
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>
              </div>
            )}
            <div className="flex items-end gap-2 md:col-span-2 lg:col-span-1">
              <Button onClick={() => save()} disabled={saving || over > 0} className="flex-1">
                {saving ? "Saving…" : editing ? "Save Payment Changes" : "Record Payment"}
              </Button>
              {canCloseBill && !editing && (
                <Button variant="outline" onClick={closeBill} disabled={saving || st.pending <= 0}
                  className="border-emerald-500 text-emerald-600 hover:bg-emerald-50">
                  Close bill
                </Button>
              )}
            </div>
          </div>
        )}

        {payments.length > 0 && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-semibold mb-3">Payment History</h4>
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH className="py-2">Date</TH>
                    <TH className="py-2">Method</TH>
                    <TH className="py-2 text-right">Amount</TH>
                    <TH className="py-2">Notes</TH>
                    <TH className="py-2 text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {payments.map((p) => {
                    const neg = Number(p.amount) < 0;
                    return (
                      <TR key={p.id} className={editing?.id === p.id ? "bg-blue-50" : ""}>
                        <TD className="py-2 text-xs">{formatDate(p.date || p.createdAt)}</TD>
                        <TD className="py-2 text-xs font-medium">{p.method || "Cash"}</TD>
                        <TD className={`py-2 text-xs text-right font-semibold ${neg ? "text-rose-600" : "text-emerald-600"}`}>
                          {neg ? "− " : "+ "}{formatINR(Math.abs(Number(p.amount)))}
                        </TD>
                        <TD className="py-2 text-xs text-muted-foreground">{p.notes || "—"}</TD>
                        <TD className="py-2 text-right space-x-1">
                          <Button size="xs" variant="outline" onClick={() => startEdit(p)} className="h-7 text-xs">Edit</Button>
                          <Button size="xs" variant="outline" onClick={() => remove(p)} className="text-rose-600 border-rose-200 hover:bg-rose-50 h-7 text-xs">Delete</Button>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
