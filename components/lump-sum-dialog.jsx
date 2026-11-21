"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { formatINR, formatDate } from "@/lib/utils";
import { allocateLumpSum } from "@/lib/payments";

const METHODS = ["Cash", "UPI", "NEFT", "RTGS", "Cheque", "Bank Transfer"];
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * One amount settles a party's bills, oldest first. `bills` are the open bills in pay order:
 * [{ id, number, date, pending }]. The table previews the split before anything is saved;
 * onSubmit(amount, method) records it on the server and resolves { allocations }.
 */
export function LumpSumDialog({ open, onClose, title, verb, bills, onSubmit }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setAmount(""); setMethod("Cash"); } }, [open]);

  const total = r2(bills.reduce((s, b) => s + b.pending, 0));
  const value = r2(Number(amount) || 0);
  const over = value > total;
  const valid = value > 0 && !over && bills.length > 0;
  const { parts } = value > 0 && !over ? allocateLumpSum(bills, value) : { parts: [] };
  const paidOf = Object.fromEntries(parts.map((p) => [p.id, p.amount]));

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const r = await onSubmit(value, method);
      toast({
        type: "success",
        title: `${verb} ${formatINR(value)}`,
        message: (r.allocations || []).map((a) => `${a.number}: ${formatINR(a.amount)}`).join(" · ")
      });
      onClose();
    } catch (e) {
      toast({ type: "error", title: "Could not record the lump sum", message: e.message });
    } finally { setSaving(false); }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || saving}>
            {saving ? "Saving…" : value > 0 ? `${verb} ${formatINR(value)}` : `${verb}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Open balance <strong>{formatINR(total)}</strong> over {bills.length} {bills.length === 1 ? "bill" : "bills"}.
          The amount clears the oldest bill first, then the next, until it runs out.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Amount (₹)">
            <Input type="number" min="0" step="0.01" autoFocus value={amount}
              placeholder={`Up to ${formatINR(total)}`} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Payment Method">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </Select>
          </Field>
        </div>

        {over && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded p-2">
            {formatINR(value)} is more than the open balance {formatINR(total)}. Enter a smaller amount.
          </p>
        )}

        {valid && (
          <div className="max-h-72 overflow-auto rounded border">
            <Table>
              <THead><TR>
                <TH>Bill</TH><TH>Date</TH><TH className="text-right">Open</TH>
                <TH className="text-right">This amount</TH><TH className="text-right">Left after</TH>
              </TR></THead>
              <TBody>
                {bills.map((b) => {
                  const pay = paidOf[b.id] || 0;
                  const after = r2(b.pending - pay);
                  return (
                    <TR key={b.id} className={pay === 0 ? "text-muted-foreground" : ""}>
                      <TD className="font-mono text-xs">{b.number}</TD>
                      <TD className="text-xs">{formatDate(b.date)}</TD>
                      <TD className="text-right text-xs">{formatINR(b.pending)}</TD>
                      <TD className="text-right text-xs font-semibold">{pay ? formatINR(pay) : "—"}</TD>
                      <TD className="text-right text-xs">{after > 0 ? formatINR(after) : <span className="text-emerald-600">Cleared</span>}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      </div>
    </Dialog>
  );
}
