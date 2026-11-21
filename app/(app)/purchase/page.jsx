"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { setInnerBack } from "@/components/back-handler";
import { Plus, Sparkles, CreditCard, FileText, Trash2, Building2, FileClock, CheckCheck, Banknote } from "lucide-react";
import { PaymentSection } from "@/components/payment-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { api, useCompany } from "@/components/company-context";
import { formatDate, formatINR } from "@/lib/utils";
import { isGstCompany } from "@/lib/gst";
import { NoCompanySelected } from "@/components/empty-state";
import { LumpSumDialog } from "@/components/lump-sum-dialog";
import { oldestFirst, supplierKey } from "@/lib/payments";
import { useToast } from "@/components/ui/toast";

export default function PurchasesPage() {
  const toast = useToast();
  const { active } = useCompany();
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("suppliers");
  const [approvingDraft, setApprovingDraft] = useState(null);
  
  // State for the "Personal Dashboard" View
  const [selectedSupplierName, setSelectedSupplierName] = useState(null);
  // Which bill the supplier summary shows: "all" (combined) or a bill id.
  const [billFilter, setBillFilter] = useState("all");

  const [selectedBill, setSelectedBill] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lumpOpen, setLumpOpen] = useState(false);
  // Party ledger lines (every bill and payment) of the supplier on screen, for the passbook.
  const [passbookLines, setPassbookLines] = useState([]);

  useEffect(() => {
    if (active?.id) {
      api("/api/purchases").then(setList).catch(() => setList([]));
      api("/api/customers").then(setCustomers).catch(() => setCustomers([]));
    }
  }, [active?.id]);

  // The passbook reads the party ledger: one line per bill and per payment, with running balance.
  useEffect(() => {
    if (!active?.id || !selectedSupplierName) return;
    let alive = true;
    setPassbookLines([]);
    api(`/api/reports/ledger?party=suppliers&key=${encodeURIComponent(selectedSupplierName)}`)
      .then((st) => { if (alive) setPassbookLines(st.ledger); })
      .catch(() => { if (alive) setPassbookLines([]); });
    return () => { alive = false; };
  }, [active?.id, selectedSupplierName, list]);

  if (!active) return <NoCompanySelected />;

  // Group purchases by Supplier
  const suppliersMap = new Map();
  list.forEach(p => {
    // Grouped the same way as the ledger and outstanding report: ignoring case and spaces.
    const k = supplierKey(p.supplierName);
    if (!suppliersMap.has(k)) {
      suppliersMap.set(k, {
        key: k,
        name: (p.supplierName || "").trim() || "Unknown Supplier",
        gst: p.supplierGst,
        purchases: []
      });
    }
    suppliersMap.get(k).purchases.push(p);
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
    // Fetch full detail with payments
    try {
      const full = await api(`/api/purchases/${p.id}`);
      setSelectedBill(full);
    } catch {}
  }

  // Payment calls for the bill's PaymentSection. Each reloads the bill so list and dialog stay in step.
  async function reloadBill() {
    const full = await api(`/api/purchases/${selectedBill.id}`);
    setList((prev) => prev.map((p) => (p.id === full.id ? full : p)));
    setSelectedBill(full);
  }

  async function recordBillPayment(d) {
    await api(`/api/purchases/${selectedBill.id}/payments`, { method: "POST", body: JSON.stringify(d) });
    await reloadBill();
  }

  async function updateBillPayment(p, d) {
    await api(`/api/payments/${p.id}`, { method: "PUT", body: JSON.stringify(d) });
    await reloadBill();
  }

  async function deleteBillPayment(id) {
    await api(`/api/payments/${id}`, { method: "DELETE" });
    await reloadBill();
  }

  // Lump sum to one supplier: the server pays their bills oldest first and records each part.
  async function paySupplierLump(supplierName, amount, method) {
    const r = await api("/api/purchases/lump-payment", { method: "POST", body: JSON.stringify({ supplierName, amount, method }) });
    setList(await api("/api/purchases"));
    return r;
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
      toast({ type: "error", title: "Delete failed", message: e.message || "Failed to delete purchase" });
    } finally {
      setSaving(false);
    }
  }



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
                    {isGstCompany(active) && <th className="text-right p-2 font-medium">GST%</th>}
                    <th className="text-right p-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(selectedBill.items) ? selectedBill.items : []).map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{it.name}</td>
                      <td className="p-2 text-right">{it.quantity} {it.unit}</td>
                      <td className="p-2 text-right">{formatINR(it.purchasePrice)}</td>
                      {isGstCompany(active) && <td className="p-2 text-right">{it.gstRate}%</td>}
                      <td className="p-2 text-right font-medium">{formatINR(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

                        <PaymentSection
              total={selectedBill.total}
              payments={selectedBill.payments || []}
              canCloseBill
              onRecord={recordBillPayment}
              onUpdate={updateBillPayment}
              onDelete={deleteBillPayment}
            />
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
      toast({ type: "error", title: "Approve failed", message: e.message || "Failed to approve draft" });
    } finally {
      setApprovingDraft(null);
    }
  }

  // Render Personal Dashboard if a supplier is selected
  if (selectedSupplierName) {
    const supplierData = suppliersMap.get(selectedSupplierName);
    const supplierPurchases = supplierData ? supplierData.purchases : [];
    
    // The summary shows every bill combined, or only the bill picked in the selector.
    const filterBill = supplierPurchases.find((p) => p.id === billFilter) || null;
    const shownBills = filterBill ? [filterBill] : supplierPurchases;
    const sBilled = shownBills.reduce((s, p) => s + Number(p.total || 0), 0);
    const sPaid = shownBills.reduce((s, p) => s + Number(p.amountPaid || 0), 0);
    const sPending = sBilled - sPaid;
    // Open bills of this supplier in pay order (drafts are not bills yet). A lump sum covers all of them.
    const lumpBills = supplierPurchases
      .filter((p) => p.status !== "Draft")
      .map((p) => ({ id: p.id, number: p.billNumber || "—", date: p.billDate, pending: Number(p.total || 0) - Number(p.amountPaid || 0) }))
      .filter((b) => b.pending > 0)
      .sort(oldestFirst);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{supplierData.name}</h1>
              <p className="text-sm text-muted-foreground">{supplierData.gst ? `GSTIN: ${supplierData.gst}` : "No GSTIN provided"}</p>
            </div>
          </div>
          {supplierPurchases.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Show</span>
              <Select className="min-w-[280px]" value={filterBill ? filterBill.id : "all"} onChange={(e) => setBillFilter(e.target.value)}>
                <option value="all">All bills combined ({supplierPurchases.length})</option>
                {supplierPurchases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.billNumber || "No number"} · {formatDate(p.billDate)} · {formatINR(p.total)}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </div>

        {/* Supplier Specific Summary */}
        <p className="text-xs text-muted-foreground">
          {filterBill ? `Figures for bill ${filterBill.billNumber || "(no number)"} only.` : `Figures for all ${supplierPurchases.length} bills combined.`}
        </p>
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

        {/* Purchase Bills & Payment Actions */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Supplier Bills ({supplierPurchases.length})</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Click on any bill or &quot;Pay Bill&quot; to record cash/bank payments to {supplierData.name}.</p>
            </div>
            <Button variant="outline" className="border-emerald-500 text-emerald-600 hover:bg-emerald-50 shrink-0" onClick={() => setLumpOpen(true)}
              disabled={lumpBills.length === 0} title="One amount, applied to the oldest bill first">
              <Banknote className="h-4 w-4" /> Pay lump sum
            </Button>
          </CardHeader>
          <CardContent>
            {supplierPurchases.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 text-center border border-dashed rounded-lg">No purchase bills found for this supplier.</div>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Bill #</TH>
                    <TH>Date</TH>
                    <TH className="text-right">Total</TH>
                    <TH className="text-right text-emerald-600">Paid</TH>
                    <TH className="text-right text-red-600">Pending</TH>
                    <TH>Status</TH>
                    <TH className="text-center">Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {supplierPurchases.map((p) => {
                    const pendingAmt = Math.max(0, Number(p.total || 0) - Number(p.amountPaid || 0));
                    return (
                      <TR
                        key={p.id}
                        className={`cursor-pointer hover:bg-muted/50 transition-colors ${filterBill?.id === p.id ? "bg-primary/10" : ""}`}
                        onClick={() => openDetail(p)}
                      >
                        <TD className="font-mono text-xs font-semibold">{p.billNumber || "—"}</TD>
                        <TD className="text-xs">{formatDate(p.billDate)}</TD>
                        <TD className="text-right font-semibold text-xs">{formatINR(p.total)}</TD>
                        <TD className="text-right text-emerald-600 font-medium text-xs">{formatINR(p.amountPaid || 0)}</TD>
                        <TD className="text-right font-semibold text-xs" style={{ color: pendingAmt > 0 ? "#ef4444" : "#16a34a" }}>
                          {formatINR(pendingAmt)}
                        </TD>
                        <TD><StatusBadge status={p.status} /></TD>
                        <TD className="text-center">
                          <Button size="xs" variant="outline" className="border-emerald-500 text-emerald-600 hover:bg-emerald-50" onClick={(e) => { e.stopPropagation(); openDetail(p); }}>
                            <CreditCard className="h-3 w-3 mr-1" /> Pay Bill
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

        {/* Supplier Passbook Statement (Credit & Debit) */}
        {(() => {
          // Newest first, as the passbook lists them. Corrections (negative payments) show in the Credit column.
          const supplierStatement = [...passbookLines].reverse().map((e) => ({
            date: e.date,
            refNo: e.refNo,
            particulars: e.particulars,
            type: e.debit > 0 || e.credit < 0 ? "PURCHASE_BILL" : "PAYMENT_PAID",
            udhar: e.debit > 0 ? e.debit : Math.max(0, -e.credit),
            jama: Math.max(0, e.credit),
            runningBalance: e.balance,
            rawBill: supplierPurchases.find((p) => (p.billNumber || "—") === e.refNo) || null
          }));

          return (
            <Card className="border-indigo-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" /> Supplier Passbook Statement (Credit & Debit)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Chronological supplier passbook: Purchase bills received (Credit / We Owe) vs Payments paid (Debit / Money Out).
                </p>
              </CardHeader>
              <CardContent>
                {supplierStatement.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-4 text-center">No supplier transactions recorded yet.</div>
                ) : (
                  <Table>
                    <THead>
                      <TR>
                        <TH>Date</TH>
                        <TH>Type</TH>
                        <TH>Ref / Bill #</TH>
                        <TH>Particulars / Description</TH>
                        <TH className="text-right text-rose-600">Credit (Purchase Bill)</TH>
                        <TH className="text-right text-emerald-600">Debit (Payment Paid)</TH>
                        <TH className="text-right">Running Payable Balance</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {supplierStatement.map((row, idx) => (
                        <TR 
                          key={idx} 
                          className={`cursor-pointer hover:bg-muted/50 transition-colors ${row.type === "PAYMENT_PAID" ? "bg-emerald-50/30 font-medium" : ""}`}
                          onClick={() => row.rawBill && openDetail(row.rawBill)}
                        >
                          <TD className="text-xs">{formatDate(row.date)}</TD>
                          <TD>
                            {row.type === "PAYMENT_PAID" && <StatusBadge status="Paid" />}
                            {row.type === "PURCHASE_BILL" && <StatusBadge status="Unpaid" />}
                          </TD>
                          <TD className="font-semibold text-xs">{row.refNo}</TD>
                          <TD className="text-xs">{row.particulars}</TD>
                          <TD className="text-right font-semibold text-rose-600 text-xs">
                            {row.udhar > 0 ? formatINR(row.udhar) : "—"}
                          </TD>
                          <TD className="text-right font-semibold text-emerald-600 text-xs">
                            {row.jama > 0 ? `- ${formatINR(row.jama)}` : "—"}
                          </TD>
                          <TD className={`text-right font-bold text-xs ${row.runningBalance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                            {formatINR(row.runningBalance)}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })()}

        <LumpSumDialog
          open={lumpOpen}
          onClose={() => setLumpOpen(false)}
          title={`Pay ${supplierData.name} — lump sum`}
          verb="Paid"
          bills={lumpBills}
          onSubmit={(amount, method) => paySupplierLump(supplierData.name, amount, method)}
        />

        {/* We reuse the exact same Payment Modal here */}
        {renderPaymentModal()}
      </div>
    );
  }

  // --- Main Supplier Grid View ---
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Purchases & Suppliers</h1>
          <p className="text-sm text-muted-foreground">Manage your vendors, supplier bills, and payables.</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
                        catch (e) { toast({ type: "error", title: "Delete failed", message: e.message }); }
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
                <Card 
                  key={s.key} 
                  className="flex flex-col hover:border-primary/60 hover:shadow-md transition-all shadow-sm cursor-pointer group"
                  onClick={() => setSelectedSupplierName(s.key)}
                >
                  <CardHeader className="p-4 pb-3 border-b bg-muted/10">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors"><Building2 className="h-4 w-4 text-primary" /></div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors" title={s.name}>{s.name}</h3>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{s.gst ? <div className="truncate">📝 GST: {s.gst}</div> : <div className="italic">No GSTIN</div>}</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 flex-1 flex flex-col gap-3">
                    <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Total Billed</span><span className="font-medium">{formatINR(s.totalBilled)}</span></div>
                    <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Total Paid</span><span className="font-medium text-emerald-600">{formatINR(s.totalPaid)}</span></div>
                    <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Pending</span><span className="font-medium text-red-600">{formatINR(s.totalPending)}</span></div>
                    <div className="mt-auto pt-3">
                      <Button variant="outline" className="w-full h-8 text-xs bg-muted/30 group-hover:bg-primary group-hover:text-primary-foreground transition-colors" onClick={(e) => { e.stopPropagation(); setSelectedSupplierName(s.key); }}>
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
