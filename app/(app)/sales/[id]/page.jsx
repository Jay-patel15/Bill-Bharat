"use client";
import { useEffect, useState } from "react";
import { Download, Save, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { api } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";
import { formatINR, formatDate } from "@/lib/utils";

export default function InvoiceViewPage({ params }) {
  const toast = useToast();
  const [sale, setSale] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [totalPaid, setTotalPaid] = useState(0);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [payRef, setPayRef] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [status, setStatus] = useState("");
  const [pdfLink, setPdfLink] = useState("");
  const [payments, setPayments] = useState([]);
  const [editingPayment, setEditingPayment] = useState(null);

  async function load() {
    const s = await api(`/api/sales/${params.id}`);
    setSale(s);
    setTotalPaid(Number(s.amountPaid) || 0);
    setPayments(s.payments || []);
    setStatus(s.status);
    setPdfLink(s.pdfUrl || "");
    if (s.customerId) {
      try { setCustomer(await api(`/api/customers/${s.customerId}`)); } catch {}
    }
  }
  useEffect(() => { load(); }, [params.id]);

  if (!sale) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const items = typeof sale.items === "string" ? JSON.parse(sale.items || "[]") : (sale.items || []);
  const interstate = Number(sale.igst || 0) > 0;

  async function savePayment() {
    try {
      const inputVal = Number(payAmount) || 0;
      const newTotal = editMode ? inputVal : totalPaid + inputVal;
      const grandTotal = Number(sale.total || 0);

      if (newTotal > grandTotal) {
        toast({ 
          type: "error", 
          title: "Overpayment", 
          message: `Total paid (${formatINR(newTotal)}) cannot exceed grand total (${formatINR(grandTotal)}).` 
        });
        return;
      }

      // Auto-calculate status
      let newStatus = "Unpaid";
      if (newTotal >= grandTotal) newStatus = "Paid";
      else if (newTotal > 0) newStatus = "Partially Paid";

      const refLabel = payRef.trim() ? ` | Ref: ${payRef.trim()}` : "";
      
      await api(`/api/sales/${sale.id}`, {
        method: "PUT", 
        body: JSON.stringify({ 
          amountPaid: newTotal, 
          status: newStatus,
          paymentMethod: payMethod,
          paymentNotes: editMode 
            ? `Correction to ${formatINR(newTotal)}` 
            : `Payment for ${sale.invoiceNumber}${refLabel}`
        })
      });
      
      toast({ type: "success", title: editMode ? "Paid amount corrected" : "Payment recorded" });
      setPayAmount("");
      setPayRef("");
      setEditMode(false);
      await load();
    } catch (e) { 
      toast({ type: "error", title: "Save failed", message: e.message }); 
    }
  }


  async function deletePayment(paymentId) {
    if (!confirm("Delete this payment entry? The invoice total will be recalculated.")) return;
    try {
      await api(`/api/payments/${paymentId}`, { method: "DELETE" });
      toast({ type: "success", title: "Payment entry deleted" });
      await load();
    } catch (e) {
      toast({ type: "error", title: "Delete failed", message: e.message });
    }
  }

  async function saveEditPayment() {
    if (!editingPayment) return;
    try {
      const refSuffix = editingPayment.ref?.trim() ? ` | Ref: ${editingPayment.ref.trim()}` : "";
      const finalNotes = (editingPayment.baseNotes || "").trim() + refSuffix;
      await api(`/api/payments/${editingPayment.id}`, {
        method: "PUT",
        body: JSON.stringify({
          amount: Number(editingPayment.amount),
          method: editingPayment.method,
          notes: finalNotes,
        })
      });
      toast({ type: "success", title: "Payment updated" });
      setEditingPayment(null);
      await load();
    } catch (e) {
      toast({ type: "error", title: "Update failed", message: e.message });
    }
  }

  async function persistPdf() {
    try {
      const res = await fetch(`/api/sales/${sale.id}/pdf?save=1`, {
        method: "GET", headers: { "x-company-id": sale.companyId }
      });
      const json = await res.json();
      if (json.ok) {
        setPdfLink(json.data.viewUrl);
        toast({ type: "success", title: "PDF saved to Drive" });
        await load();
      } else throw new Error(json.error);
    } catch (e) { toast({ type: "error", title: "Could not save PDF", message: e.message }); }
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(
      `Invoice ${sale.invoiceNumber} — ${formatINR(sale.total)}${pdfLink ? `\n${pdfLink}` : ""}`
    );
    const phone = customer?.phone ? customer.phone.replace(/\D/g, "") : "";
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{sale.invoiceNumber}</h1>
            <span className="px-2 py-0.5 rounded-full bg-muted text-xs">{sale.documentType || "Tax Invoice"}</span>
          </div>
          <p className="text-sm text-muted-foreground">{formatDate(sale.invoiceDate)} · {customer?.name || "—"}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/sales/${sale.id}/pdf`} target="_blank" rel="noreferrer">
            <Button variant="outline" title="View or Download PDF"><Download className="h-4 w-4" /> PDF</Button>
          </a>
          <Button variant="outline" onClick={persistPdf} title="Save invoice PDF to Google Drive"><Save className="h-4 w-4" /> Save to Drive</Button>
          <Button variant="outline" onClick={shareWhatsApp} title="Share invoice details on WhatsApp"><Share2 className="h-4 w-4" /> WhatsApp</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Items</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Item</TH><TH>HSN</TH><TH className="text-right">Qty</TH>
                  <TH className="text-right">Rate</TH><TH className="text-right">Tax</TH>
                  <TH className="text-right">Total</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((it, i) => (
                  <TR key={i}>
                    <TD>{it.name}</TD>
                    <TD>{it.hsnCode || "—"}</TD>
                    <TD className="text-right">{it.quantity}</TD>
                    <TD className="text-right">{formatINR(it.sellingPrice)}</TD>
                    <TD className="text-right">{formatINR((it.cgst || 0) + (it.sgst || 0) + (it.igst || 0))}</TD>
                    <TD className="text-right font-medium">{formatINR(it.total)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatINR(sale.subtotal)} />
            {interstate
              ? <Row label="IGST" value={formatINR(sale.igst)} />
              : (<><Row label="CGST" value={formatINR(sale.cgst)} /><Row label="SGST" value={formatINR(sale.sgst)} /></>)}
            {Number(sale.discount) ? <Row label="Discount" value={"- " + formatINR(sale.discount)} /> : null}
            <div className="border-t pt-2">
              <Row label={<strong>Grand total</strong>} value={<strong>{formatINR(sale.total)}</strong>} />
              <Row label="Paid" value={formatINR(sale.amountPaid)} />
              <Row label="Status" value={<StatusBadge status={sale.status} />} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Update payment</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs text-muted-foreground underline"
            onClick={() => {
              setEditMode(!editMode);
              setPayAmount(editMode ? "" : String(totalPaid));
            }}
          >
            {editMode ? "Cancel Correction" : "Edit total paid amount"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {editMode && (
            <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
              ⚠️ <strong>Correction Mode:</strong> This will <strong>replace</strong> the current total paid amount ({formatINR(totalPaid)}). Use this only to fix mistakes.
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label={editMode ? "Correct Total Paid (₹)" : "Amount received now (₹)"}>
              <Input 
                type="number" 
                placeholder={editMode ? "Enter correct total" : "Enter amount received"}
                value={payAmount} 
                onChange={(e) => setPayAmount(e.target.value)} 
              />
            </Field>
            <Field label="Payment Method">
              <Select value={payMethod} onChange={(e) => { setPayMethod(e.target.value); setPayRef(""); }}>
                <option>Cash</option>
                <option>UPI</option>
                <option>NEFT</option>
                <option>RTGS</option>
                <option>Cheque</option>
                <option>Bank Transfer</option>
              </Select>
            </Field>
            {payMethod !== "Cash" && payMethod !== "Bank Transfer" && (
              <Field label={
                payMethod === "Cheque" ? "Cheque Number" :
                payMethod === "UPI" ? "UPI Transaction ID" :
                "Transaction ID (NEFT/RTGS)"
              }>
                <Input 
                  placeholder={
                    payMethod === "Cheque" ? "e.g. 004521" :
                    payMethod === "UPI" ? "e.g. UPI/123456789" :
                    "e.g. NEFT123456789"
                  }
                  value={payRef} 
                  onChange={(e) => setPayRef(e.target.value)} 
                />
              </Field>
            )}
            <div className="flex items-end">
              <Button onClick={savePayment} className="w-full md:w-auto">
                {editMode ? "Save Correction" : "Record Payment"}
              </Button>
            </div>
          </div>

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
                      <TH className="py-2" />
                    </TR>
                  </THead>
                  <TBody>
                    {payments.map((p, i) => (
                      <>
                        <TR key={p.id || i}>
                          <TD className="py-2 text-xs">{formatDate(p.date)}</TD>
                          <TD className="py-2 text-xs font-medium">{p.method}</TD>
                          <TD className="py-2 text-xs text-right font-medium text-emerald-600">
                            {p.amount > 0 ? "+" : ""}{formatINR(p.amount)}
                          </TD>
                          <TD className="py-2 text-xs text-muted-foreground">{p.notes}</TD>
                          <TD className="py-2 text-right">
                            <div className="flex gap-1 justify-end">
                              <button
                              onClick={() => {
                                if (editingPayment?.id === p.id) {
                                  setEditingPayment(null);
                                } else {
                                  // Parse existing ref from notes (format: "... | Ref: XXXX")
                                  const refMatch = (p.notes || "").match(/ \| Ref: (.+)$/);
                                  const baseNotes = refMatch ? p.notes.replace(/ \| Ref: .+$/, "") : (p.notes || "");
                                  setEditingPayment({ 
                                    id: p.id, 
                                    amount: p.amount, 
                                    method: p.method, 
                                    ref: refMatch ? refMatch[1] : "",
                                    baseNotes 
                                  });
                                }
                              }}
                                className="text-[11px] px-2 py-0.5 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
                              >{editingPayment?.id === p.id ? "Cancel" : "Edit"}</button>
                              <button
                                onClick={() => deletePayment(p.id)}
                                className="text-[11px] px-2 py-0.5 rounded border border-red-300 text-red-500 hover:bg-red-50 transition-colors"
                              >Delete</button>
                            </div>
                          </TD>
                        </TR>
                        {editingPayment?.id === p.id && (
                          <TR key={`edit-${p.id}`}>
                            <TD colSpan={5} className="py-3 bg-muted/20 border-b">
                              <div className="flex flex-wrap gap-2 items-end px-1">
                                <div>
                                  <label className="text-[11px] text-muted-foreground block mb-1">Amount (₹)</label>
                                  <Input
                                    type="number"
                                    value={editingPayment.amount}
                                    onChange={(e) => setEditingPayment({ ...editingPayment, amount: e.target.value })}
                                    className="h-7 text-xs w-32"
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-muted-foreground block mb-1">Method</label>
                                  <select
                                    value={editingPayment.method}
                                    onChange={(e) => setEditingPayment({ ...editingPayment, method: e.target.value, ref: "" })}
                                    className="h-7 text-xs rounded-md border border-input bg-background px-2 py-0.5"
                                  >
                                    <option>Cash</option>
                                    <option>UPI</option>
                                    <option>NEFT</option>
                                    <option>RTGS</option>
                                    <option>Cheque</option>
                                    <option>Bank Transfer</option>
                                  </select>
                                </div>
                                {["UPI", "NEFT", "RTGS", "Cheque"].includes(editingPayment.method) && (
                                  <div>
                                    <label className="text-[11px] text-muted-foreground block mb-1">
                                      {editingPayment.method === "Cheque" ? "Cheque Number" :
                                       editingPayment.method === "UPI" ? "UPI Transaction ID" :
                                       "Transaction ID (NEFT/RTGS)"}
                                    </label>
                                    <Input
                                      placeholder={
                                        editingPayment.method === "Cheque" ? "e.g. 004521" :
                                        editingPayment.method === "UPI" ? "e.g. UPI/123456789" :
                                        "e.g. NEFT123456789"
                                      }
                                      value={editingPayment.ref || ""}
                                      onChange={(e) => setEditingPayment({ ...editingPayment, ref: e.target.value })}
                                      className="h-7 text-xs w-40"
                                    />
                                  </div>
                                )}
                                <div className="flex-1 min-w-[160px]">
                                  <label className="text-[11px] text-muted-foreground block mb-1">Notes</label>
                                  <Input
                                    value={editingPayment.baseNotes || ""}
                                    onChange={(e) => setEditingPayment({ ...editingPayment, baseNotes: e.target.value })}
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <Button size="sm" onClick={saveEditPayment} className="h-7 text-xs">Save</Button>
                              </div>
                            </TD>
                          </TR>
                        )}
                      </>
                    ))}
                  </TBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
