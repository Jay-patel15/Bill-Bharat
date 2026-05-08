"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Sparkles, CreditCard, CheckCircle2, Clock, FileText, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { api, useCompany } from "@/components/company-context";
import { formatDate, formatINR } from "@/lib/utils";
import { NoCompanySelected } from "@/components/empty-state";

export default function PurchasesPage() {
  const { active } = useCompany();
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [editMode, setEditMode] = useState(false);   // true = override amountPaid, false = add to it
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (active?.id) api("/api/purchases").then(setList).catch(() => setList([]));
  }, [active?.id]);

  if (!active) return <NoCompanySelected />;

  const filtered = list.filter((p) =>
    [p.supplierName, p.billNumber, p.status].some((f) => (f || "").toLowerCase().includes(search.toLowerCase()))
  );

  // Summary stats
  const totalPayable = list.reduce((s, p) => s + Number(p.total || 0), 0);
  const totalPaid    = list.reduce((s, p) => s + Number(p.amountPaid || 0), 0);
  const totalPending = totalPayable - totalPaid;

  function openDetail(p) {
    setSelected(p);
    setPayAmount("");
    setPayMethod("Cash");
    setEditMode(false);
  }

  async function handlePayment(closeBill = false) {
    if (!selected) return;
    const inputAmount = Number(payAmount) || 0;
    const newTotal    = Number(selected.total || 0);

    // If closing the bill, automatically set the paid amount to the full total.
    // In edit mode we SET the amountPaid to the entered value.
    // In normal mode we ADD to existing amountPaid.
    const newPaid = closeBill
      ? newTotal
      : editMode
        ? inputAmount
        : Number(selected.amountPaid || 0) + inputAmount;

    // Validate: can't pay more than total
    if (newPaid > newTotal && !closeBill) {
      alert(`Amount paid (${formatINR(newPaid)}) cannot exceed bill total (${formatINR(newTotal)}).`);
      return;
    }

    // Status: close bill = Paid, otherwise derive from actual amounts
    const newStatus = closeBill
      ? "Paid"
      : newPaid >= newTotal
        ? "Paid"
        : newPaid > 0
          ? "Partially Paid"
          : "Unpaid";

    setSaving(true);
    try {
      const updated = await api(`/api/purchases/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({ amountPaid: newPaid, status: newStatus })
      });
      setList((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSelected(updated);
      setPayAmount("");
      setEditMode(false);
    } catch (e) {
      alert(e.message || "Failed to save payment");
    } finally {
      setSaving(false);
    }
  }

  const pending  = selected ? Math.max(0, Number(selected.total || 0) - Number(selected.amountPaid || 0)) : 0;
  // A bill is truly closed only when pending amount is 0, not just when status says "Paid"
  const isClosed = pending <= 0 && Number(selected?.amountPaid || 0) > 0;

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`Are you sure you want to delete purchase bill ${selected.billNumber || "No Number"}? This action cannot be undone.`)) return;
    
    setSaving(true);
    try {
      await api(`/api/purchases/${selected.id}`, { method: "DELETE" });
      setList((prev) => prev.filter((p) => p.id !== selected.id));
      setSelected(null);
    } catch (e) {
      alert(e.message || "Failed to delete purchase");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Purchases</h1>
          <p className="text-sm text-muted-foreground">Track supplier bills, GST input credit and payables.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/purchase/ai-upload">
            <Button variant="outline"><Sparkles className="h-4 w-4 mr-1" />AI upload</Button>
          </Link>
          <Link href="/purchase/create">
            <Button><Plus className="h-4 w-4 mr-1" />New purchase</Button>
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Bills",   value: list.length,              color: "text-foreground",  Icon: FileText },
          { label: "Total Payable", value: formatINR(totalPayable),  color: "text-foreground",  Icon: CreditCard },
          { label: "Amount Paid",   value: formatINR(totalPaid),     color: "text-emerald-600", Icon: CheckCircle2 },
          { label: "Pending",       value: formatINR(totalPending),  color: "text-red-500",     Icon: Clock },
        ].map(({ label, value, color, Icon }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-8 w-8 ${color} opacity-75`} />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>All purchases ({filtered.length})</CardTitle>
          <Input
            placeholder="Search supplier, bill #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4">No purchases yet.</div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Bill #</TH>
                  <TH>Date</TH>
                  <TH>Supplier</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="text-right">Paid</TH>
                  <TH className="text-right">Pending</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((p) => {
                  const pendingAmt = Math.max(0, Number(p.total || 0) - Number(p.amountPaid || 0));
                  return (
                    <TR
                      key={p.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => openDetail(p)}
                    >
                      <TD className="font-mono text-xs">{p.billNumber || "—"}</TD>
                      <TD>{formatDate(p.billDate)}</TD>
                      <TD className="font-medium">{p.supplierName}</TD>
                      <TD className="text-right font-semibold">{formatINR(p.total)}</TD>
                      <TD className="text-right text-emerald-600">{formatINR(p.amountPaid || 0)}</TD>
                      <TD className="text-right font-medium" style={{ color: pendingAmt > 0 ? "var(--destructive, #ef4444)" : "var(--success, #16a34a)" }}>
                        {formatINR(pendingAmt)}
                      </TD>
                      <TD><StatusBadge status={p.status} /></TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Purchase Detail + Payment Modal */}
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Bill — ${selected.billNumber || "No Number"} · ${selected.supplierName}` : ""}
        size="lg"
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              {/* Supplier meta */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mt-1">
                {selected.supplierGst && (
                  <span><span className="text-muted-foreground">GSTIN: </span>{selected.supplierGst}</span>
                )}
                <span><span className="text-muted-foreground">Bill Date: </span>{formatDate(selected.billDate)}</span>
                {selected.notes && (
                  <span><span className="text-muted-foreground">Notes: </span>{selected.notes}</span>
                )}
              </div>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleDelete} 
                disabled={saving}
                className="opacity-80 hover:opacity-100"
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete Bill
              </Button>
            </div>

            {/* Items */}
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Item</th>
                    <th className="text-right p-2 font-medium">Qty</th>
                    <th className="text-right p-2 font-medium">Rate</th>
                    <th className="text-right p-2 font-medium">GST%</th>
                    <th className="text-right p-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(selected.items) ? selected.items : []).map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{it.name}</td>
                      <td className="p-2 text-right">{it.quantity} {it.unit}</td>
                      <td className="p-2 text-right">{formatINR(it.purchasePrice)}</td>
                      <td className="p-2 text-right">{it.gstRate}%</td>
                      <td className="p-2 text-right font-medium">{formatINR(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Bill Total</p>
                <p className="text-xl font-bold">{formatINR(selected.total)}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                <p className="text-xs text-emerald-600 mb-1">Amount Paid</p>
                <p className="text-xl font-bold text-emerald-700">{formatINR(selected.amountPaid || 0)}</p>
              </div>
              <div className={`rounded-lg border p-3 text-center ${pending > 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
                <p className={`text-xs mb-1 ${pending > 0 ? "text-red-500" : "text-emerald-600"}`}>Pending</p>
                <p className={`text-xl font-bold ${pending > 0 ? "text-red-600" : "text-emerald-700"}`}>{formatINR(pending)}</p>
              </div>
            </div>

            {/* Status + payment form */}
            {!isClosed || editMode ? (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {editMode ? "Edit Total Paid Amount" : "Record Payment to Supplier"}
                  </p>
                  {/* Toggle between Add mode and Edit mode */}
                  {!editMode ? (
                    <button
                      className="text-xs text-blue-600 underline hover:text-blue-800"
                      onClick={() => { setEditMode(true); setPayAmount(String(selected.amountPaid || "")); }}
                    >
                      ✏️ Edit paid amount
                    </button>
                  ) : (
                    <button
                      className="text-xs text-muted-foreground underline"
                      onClick={() => { setEditMode(false); setPayAmount(""); }}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>

                {editMode && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                    ⚠️ Edit mode: This will <strong>replace</strong> the current paid amount (not add to it). Use this to correct a wrong entry.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      {editMode ? "Correct Total Paid Amount (₹)" : "Amount Paying Now (₹)"}
                    </label>
                    <Input
                      type="number"
                      min="0"
                      placeholder={editMode ? `Currently ${formatINR(selected.amountPaid || 0)}` : `Max ${formatINR(pending)}`}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Payment Method</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                    >
                      {["Cash", "Bank Transfer", "UPI", "Cheque", "NEFT/RTGS"].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  {editMode ? (
                    <Button
                      onClick={() => handlePayment(false)}
                      disabled={saving || !payAmount}
                      className="flex-1"
                    >
                      {saving ? "Saving…" : "Save Corrected Amount"}
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => handlePayment(false)}
                        disabled={saving || !payAmount}
                        className="flex-1"
                      >
                        {saving ? "Saving…" : "Record Payment"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handlePayment(true)}
                        disabled={saving}
                        className="border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Close Bill (Mark Fully Paid)
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="border border-emerald-300 rounded-lg p-4 bg-emerald-50 flex items-center justify-between text-emerald-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">This bill is fully paid and closed.</span>
                </div>
                <button
                  className="text-xs text-blue-600 underline hover:text-blue-800"
                  onClick={() => { setEditMode(true); setPayAmount(String(selected.amountPaid || "")); }}
                >
                  ✏️ Edit paid amount
                </button>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
