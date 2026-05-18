"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Sparkles, CreditCard, CheckCircle2, FileText, Trash2, ArrowLeft, Building2, FileClock, CheckCheck } from "lucide-react";
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
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("suppliers");
  const [approvingDraft, setApprovingDraft] = useState(null);
  
  // State for the "Personal Dashboard" View
  const [selectedSupplierName, setSelectedSupplierName] = useState(null);
  
  // State for the specific bill Payment Modal
  const [selectedBill, setSelectedBill] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [payRef, setPayRef] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (active?.id) {
      api("/api/purchases").then(setList).catch(() => setList([]));
      api("/api/customers").then(setCustomers).catch(() => setCustomers([]));
    }
  }, [active?.id]);

  if (!active) return <NoCompanySelected />;

  // Group purchases by Supplier
  const suppliersMap = new Map();
  list.forEach(p => {
    const sName = p.supplierName || "Unknown Supplier";
    if (!suppliersMap.has(sName)) {
      suppliersMap.set(sName, {
        name: sName,
        gst: p.supplierGst,
        purchases: []
      });
    }
    suppliersMap.get(sName).purchases.push(p);
  });
  
  const suppliers = Array.from(suppliersMap.values()).map(s => {
    const totalBilled = s.purchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const totalPaid = s.purchases.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);
    const totalPending = totalBilled - totalPaid;
    return { ...s, totalBilled, totalPaid, totalPending };
  });

  // Filter for grid
  const filteredSuppliers = suppliers.filter((s) =>
    [s.name, s.gst].some((f) => (f || "").toLowerCase().includes(search.toLowerCase()))
  );

  // Global Summary stats
  const totalGlobalPayable = list.reduce((s, p) => s + Number(p.total || 0), 0);
  const totalGlobalPaid    = list.reduce((s, p) => s + Number(p.amountPaid || 0), 0);
  const totalGlobalPending = totalGlobalPayable - totalGlobalPaid;

  // --- Payment Modal Logic ---
  async function openDetail(p) {
    setSelectedBill(p);
    setPayAmount("");
    setPayMethod("Cash");
    setPayRef("");
    setEditMode(false);
    // Fetch full detail with payments
    try {
      const full = await api(`/api/purchases/${p.id}`);
      setSelectedBill(full);
    } catch {}
  }

  async function handlePayment(closeBill = false) {
    if (!selectedBill) return;
    const inputAmount = Number(payAmount) || 0;
    const newTotal    = Number(selectedBill.total || 0);

    const newPaid = closeBill
      ? newTotal
      : editMode
        ? inputAmount
        : Number(selectedBill.amountPaid || 0) + inputAmount;

    if (newPaid > newTotal && !closeBill) {
      alert(`Amount paid (${formatINR(newPaid)}) cannot exceed bill total (${formatINR(newTotal)}).`);
      return;
    }

    const newStatus = closeBill
      ? "Paid"
      : newPaid >= newTotal
        ? "Paid"
        : newPaid > 0
          ? "Partially Paid"
          : "Unpaid";

    setSaving(true);
    try {
      const updated = await api(`/api/purchases/${selectedBill.id}`, {
        method: "PUT",
        body: JSON.stringify({ 
          amountPaid: newPaid, 
          status: newStatus,
          paymentMethod: payMethod,
          paymentNotes: editMode 
            ? `Correction to ${formatINR(newPaid)}` 
            : `Payment of ${formatINR(inputAmount)}${payRef.trim() ? ` | Ref: ${payRef.trim()}` : ""}`
        })
      });
      setList((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSelectedBill(updated);
      setPayAmount("");
      setPayRef("");
      setEditMode(false);
    } catch (e) {
      alert(e.message || "Failed to save payment");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedBill) return;
    if (!confirm(`Are you sure you want to delete purchase bill ${selectedBill.billNumber || "No Number"}? This action cannot be undone.`)) return;
    
    setSaving(true);
    try {
      await api(`/api/purchases/${selectedBill.id}`, { method: "DELETE" });
      setList((prev) => prev.filter((p) => p.id !== selectedBill.id));
      setSelectedBill(null);
    } catch (e) {
      alert(e.message || "Failed to delete purchase");
    } finally {
      setSaving(false);
    }
  }

  const pendingAmount = selectedBill ? Math.max(0, Number(selectedBill.total || 0) - Number(selectedBill.amountPaid || 0)) : 0;
  const isClosed = pendingAmount <= 0 && Number(selectedBill?.amountPaid || 0) > 0;

  // Define Payment Modal helper so we can reuse it
  function renderPaymentModal() {
    return (
      <Dialog
        open={!!selectedBill}
        onClose={() => setSelectedBill(null)}
        title={selectedBill ? `Bill — ${selectedBill.billNumber || "No Number"} · ${selectedBill.supplierName}` : ""}
        size="lg"
      >
        {selectedBill && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mt-1">
                {selectedBill.customerId && (
                  <span><span className="text-muted-foreground">Billed To: </span><span className="font-semibold text-primary">{customers.find(c => c.id === selectedBill.customerId)?.name || "Unknown"}</span></span>
                )}
                {selectedBill.supplierGst && (
                  <span><span className="text-muted-foreground">GSTIN: </span>{selectedBill.supplierGst}</span>
                )}
                <span><span className="text-muted-foreground">Bill Date: </span>{formatDate(selectedBill.billDate)}</span>
                {selectedBill.notes && (
                  <span><span className="text-muted-foreground">Notes: </span>{selectedBill.notes}</span>
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
                  {(Array.isArray(selectedBill.items) ? selectedBill.items : []).map((it, i) => (
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
                <p className="text-xl font-bold">{formatINR(selectedBill.total)}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                <p className="text-xs text-emerald-600 mb-1">Amount Paid</p>
                <p className="text-xl font-bold text-emerald-700">{formatINR(selectedBill.amountPaid || 0)}</p>
              </div>
              <div className={`rounded-lg border p-3 text-center ${pendingAmount > 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
                <p className={`text-xs mb-1 ${pendingAmount > 0 ? "text-red-500" : "text-emerald-600"}`}>Pending</p>
                <p className={`text-xl font-bold ${pendingAmount > 0 ? "text-red-600" : "text-emerald-700"}`}>{formatINR(pendingAmount)}</p>
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
                  {!editMode ? (
                    <button
                      className="text-xs text-blue-600 underline hover:text-blue-800"
                      onClick={() => { setEditMode(true); setPayAmount(String(selectedBill.amountPaid || "")); }}
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
                      placeholder={editMode ? `Currently ${formatINR(selectedBill.amountPaid || 0)}` : `Max ${formatINR(pendingAmount)}`}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Payment Method</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={payMethod}
                      onChange={(e) => { setPayMethod(e.target.value); setPayRef(""); }}
                    >
                      {["Cash", "UPI", "NEFT", "RTGS", "Cheque", "Bank Transfer"].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  {payMethod !== "Cash" && payMethod !== "Bank Transfer" && (
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {payMethod === "Cheque" ? "Cheque Number" :
                         payMethod === "UPI" ? "UPI Transaction ID" :
                         "Transaction ID (NEFT/RTGS)"}
                      </label>
                      <Input
                        placeholder={
                          payMethod === "Cheque" ? "e.g. 004521" :
                          payMethod === "UPI" ? "e.g. UPI/123456789" :
                          "e.g. NEFT123456789"
                        }
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                      />
                    </div>
                  )}
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
                        Close Bill
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
                  onClick={() => { setEditMode(true); setPayAmount(String(selectedBill.amountPaid || "")); }}
                >
                  ✏️ Edit paid amount
                </button>
              </div>
            )}

            {/* Payment History */}
            {selectedBill.payments?.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/30 p-2 border-b text-xs font-semibold uppercase tracking-wider">Payment History</div>
                <table className="w-full text-xs">
                  <thead className="bg-muted/20">
                    <tr>
                      <th className="text-left p-2 font-medium">Date</th>
                      <th className="text-left p-2 font-medium">Method</th>
                      <th className="text-right p-2 font-medium">Amount</th>
                      <th className="text-left p-2 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBill.payments.map((pay, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 text-muted-foreground">{formatDate(pay.date)}</td>
                        <td className="p-2">{pay.method}</td>
                        <td className={`p-2 text-right font-medium ${pay.amount > 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {pay.amount > 0 ? "-" : "+"}{formatINR(Math.abs(pay.amount))}
                        </td>
                        <td className="p-2 text-muted-foreground truncate max-w-[200px]" title={pay.notes}>{pay.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Dialog>
    );
  }

  async function handleApproveDraft(draft) {
    if (!confirm(`Approve draft "${draft.billNumber || 'No Number'}" and add items to inventory?`)) return;
    setApprovingDraft(draft.id);
    try {
      const updated = await api(`/api/purchases/${draft.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "Unpaid", autoCreateInventory: true })
      });
      setList((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (e) {
      alert(e.message || "Failed to approve draft");
    } finally {
      setApprovingDraft(null);
    }
  }

  // Render Personal Dashboard if a supplier is selected
  if (selectedSupplierName) {
    const supplierData = suppliersMap.get(selectedSupplierName);
    const supplierPurchases = supplierData ? supplierData.purchases : [];
    
    const sBilled = supplierPurchases.reduce((s, p) => s + Number(p.total || 0), 0);
    const sPaid = supplierPurchases.reduce((s, p) => s + Number(p.amountPaid || 0), 0);
    const sPending = sBilled - sPaid;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedSupplierName(null)} className="h-8 w-8 rounded-full bg-muted/50 hover:bg-muted shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{supplierData.name}</h1>
            <p className="text-sm text-muted-foreground">{supplierData.gst ? `GSTIN: ${supplierData.gst}` : "No GSTIN provided"}</p>
          </div>
        </div>

        {/* Supplier Specific Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <p className="text-xs text-blue-600 font-semibold mb-1 uppercase tracking-wider">Total Billed</p>
              <p className="text-2xl font-bold text-blue-900">{formatINR(sBilled)}</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="p-4">
              <p className="text-xs text-emerald-600 font-semibold mb-1 uppercase tracking-wider">Amount Paid</p>
              <p className="text-2xl font-bold text-emerald-900">{formatINR(sPaid)}</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-4">
              <p className="text-xs text-red-600 font-semibold mb-1 uppercase tracking-wider">Pending Balance</p>
              <p className="text-2xl font-bold text-red-900">{formatINR(sPending)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Supplier Bills Table */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase History</CardTitle>
          </CardHeader>
          <CardContent>
            {supplierPurchases.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 text-center border border-dashed rounded-lg">No purchases found.</div>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Bill #</TH>
                    <TH>Date</TH>
                    <TH className="text-right">Total</TH>
                    <TH className="text-right">Paid</TH>
                    <TH className="text-right">Pending</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {supplierPurchases.map((p) => {
                    const pendingAmt = Math.max(0, Number(p.total || 0) - Number(p.amountPaid || 0));
                    return (
                      <TR
                        key={p.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => openDetail(p)}
                      >
                        <TD className="font-mono text-xs">{p.billNumber || "—"}</TD>
                        <TD>{formatDate(p.billDate)}</TD>
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
        
        {/* We reuse the exact same Payment Modal here */}
        {renderPaymentModal()}
      </div>
    );
  }

  // --- Main Supplier Grid View ---
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Purchases & Suppliers</h1>
          <p className="text-sm text-muted-foreground">Manage your vendors, supplier bills, and payables.</p>
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

      {/* Global Summary cards mimicking the Customers dashboard colors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-xs text-blue-600 font-semibold mb-1 uppercase tracking-wider">Total Purchase Value</p>
            <p className="text-2xl font-bold text-blue-900">{formatINR(totalGlobalPayable)}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-600 font-semibold mb-1 uppercase tracking-wider">Total Amount Paid</p>
            <p className="text-2xl font-bold text-emerald-900">{formatINR(totalGlobalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <p className="text-xs text-red-600 font-semibold mb-1 uppercase tracking-wider">Total Pending Payables</p>
            <p className="text-2xl font-bold text-red-900">{formatINR(totalGlobalPending)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 border-b">
        <button onClick={() => setActiveTab("suppliers")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "suppliers" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>Suppliers</button>
        <button onClick={() => setActiveTab("drafts")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === "drafts" ? "border-amber-500 text-amber-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <FileClock className="h-3.5 w-3.5" /> Drafts
          {list.filter(p => p.status === "Pending").length > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold px-1">{list.filter(p => p.status === "Pending").length}</span>
          )}
        </button>
      </div>

      {activeTab === "drafts" ? (
        <div className="space-y-3">
          {list.filter(p => p.status === "Pending").length === 0 ? (
            <div className="text-sm text-muted-foreground p-10 text-center border border-dashed rounded-lg bg-card flex flex-col items-center gap-2">
              <FileClock className="h-8 w-8 text-muted-foreground/40" />
              <p>No draft purchases found.</p>
              <p className="text-xs">Use <strong>AI Purchase Reader</strong> and click &quot;Save Draft&quot; to save a bill for later review.</p>
            </div>
          ) : (
            list.filter(p => p.status === "Pending").map(draft => {
              const isApproving = approvingDraft === draft.id;
              return (
                <div key={draft.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border rounded-lg p-4 bg-amber-50/50 border-amber-200 hover:border-amber-400 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5"><FileClock className="h-4 w-4 text-amber-600" /></div>
                    <div>
                      <div className="font-semibold text-sm">{draft.supplierName || "Unknown Supplier"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {draft.billNumber && <span>Bill #{draft.billNumber}</span>}
                        {draft.billDate && <span>{formatDate(draft.billDate)}</span>}
                        <span className="font-medium text-amber-700">{formatINR(draft.total || 0)}</span>
                      </div>
                      {draft.notes && <div className="text-xs text-muted-foreground mt-1 italic">{draft.notes}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs" disabled={isApproving} onClick={() => handleApproveDraft(draft)}>
                      {isApproving ? <span className="flex items-center gap-1">⏳ Approving…</span> : <span className="flex items-center gap-1"><CheckCheck className="h-3.5 w-3.5" /> Approve</span>}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:bg-destructive/10" disabled={isApproving}
                      onClick={async () => {
                        if (!confirm(`Delete draft "${draft.billNumber || 'No Number'}"?`)) return;
                        try { await api(`/api/purchases/${draft.id}`, { method: "DELETE" }); setList(prev => prev.filter(p => p.id !== draft.id)); }
                        catch (e) { alert(e.message); }
                      }}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <h2 className="text-lg font-semibold text-foreground/80">Your Suppliers ({filteredSuppliers.length})</h2>
            <Input placeholder="Search supplier, GSTIN…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs bg-background" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredSuppliers.length === 0 ? (
              <div className="col-span-full text-sm text-muted-foreground p-8 text-center border border-dashed rounded-lg bg-card">No suppliers found. Start by creating a new purchase!</div>
            ) : (
              filteredSuppliers.map((s) => (
                <Card key={s.name} className="flex flex-col hover:border-primary/50 transition-colors shadow-sm">
                  <CardHeader className="p-4 pb-3 border-b bg-muted/10">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="h-4 w-4 text-primary" /></div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-base truncate" title={s.name}>{s.name}</h3>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{s.gst ? <div className="truncate">📝 GST: {s.gst}</div> : <div className="italic">No GSTIN</div>}</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 flex-1 flex flex-col gap-3">
                    <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Total Billed</span><span className="font-medium">{formatINR(s.totalBilled)}</span></div>
                    <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Total Paid</span><span className="font-medium text-emerald-600">{formatINR(s.totalPaid)}</span></div>
                    <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Pending</span><span className="font-medium text-red-600">{formatINR(s.totalPending)}</span></div>
                    <div className="mt-auto pt-3">
                      <Button variant="outline" className="w-full h-8 text-xs bg-muted/30 hover:bg-muted/50" onClick={() => setSelectedSupplierName(s.name)}>
                        <FileText className="h-3.5 w-3.5 mr-1.5" /> View Ledger ({s.purchases.length})
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}
      {renderPaymentModal()}
    </div>
  );
}
