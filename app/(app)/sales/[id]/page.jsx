"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Save, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";
import { formatINR, formatDate, parseInvoiceNotes } from "@/lib/utils";

export default function SaleDetailPage({ params }) {
  const router = useRouter();
  const toast = useToast();
  const { active } = useCompany();

  const [sale, setSale] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [items, setItems] = useState([]);
  const [payments, setPayments] = useState([]);
  const [pdfLink, setPdfLink] = useState("");

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [payRef, setPayRef] = useState("");
  const [editMode, setEditMode] = useState(false);

  async function load() {
    try {
      const data = await api(`/api/sales/${params.id}`);
      setSale(data);
      setItems(data.items || []);
      setPayments(data.payments || []);
      if (data.notes) {
        const { drivePdfUrl } = parseInvoiceNotes(data.notes);
        if (drivePdfUrl) setPdfLink(drivePdfUrl);
      }
      if (data.customerId) {
        try { setCustomer(await api(`/api/customers/${data.customerId}`)); } catch {}
      }
    } catch (e) {
      toast({ type: "error", title: "Could not load", message: e.message });
      router.replace("/sales");
    }
  }

  useEffect(() => { if (active?.id) load(); }, [params.id, active?.id]);

  if (!sale) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const interstate = sale.supplierStateCode && sale.recipientStateCode && sale.supplierStateCode !== sale.recipientStateCode;
  
  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pendingBalance = Math.max(0, Number(sale.total || 0) - totalPaid);

  async function savePayment() {
    if (!payAmount || Number(payAmount) <= 0) {
      toast({ type: "error", title: "Invalid amount", message: "Please enter a valid payment amount." });
      return;
    }
    try {
      if (editMode) {
        await api(`/api/sales/${sale.id}`, {
          method: "PUT",
          body: JSON.stringify({ amountPaid: Number(payAmount) })
        });
        toast({ type: "success", title: "Payment amount corrected" });
        setEditMode(false);
      } else {
        await api(`/api/sales/${sale.id}/payments`, {
          method: "POST",
          body: JSON.stringify({
            amount: Number(payAmount),
            method: payMethod,
            notes: payRef ? `${payMethod} Ref: ${payRef}` : `Payment for ${sale.invoiceNumber}`
          })
        });
        toast({ type: "success", title: "Payment recorded successfully" });
      }
      setPayAmount("");
      setPayRef("");
      await load();
    } catch (e) {
      toast({ type: "error", title: "Payment failed", message: e.message });
    }
  }

  async function deletePayment(paymentId) {
    if (!confirm("Delete this payment entry?")) return;
    try {
      await api(`/api/payments/${paymentId}`, { method: "DELETE" });
      toast({ type: "success", title: "Payment entry deleted" });
      await load();
    } catch (e) {
      toast({ type: "error", title: "Failed to delete payment", message: e.message });
    }
  }

  async function persistPdf() {
    try {
      toast({ type: "info", title: "Uploading invoice PDF to Drive…" });
      const res = await fetch(`/api/sales/${sale.id}/pdf`);
      const json = await res.json();
      if (json.ok && json.data?.drivePdfUrl) {
        setPdfLink(json.data.drivePdfUrl);
        toast({ type: "success", title: "PDF saved to Google Drive", message: json.data.drivePdfUrl });
      } else throw new Error(json.error || "Failed to upload");
    } catch (e) { toast({ type: "error", title: "Could not save PDF to Drive", message: e.message }); }
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
              <Row label="Paid" value={formatINR(totalPaid)} />
              <Row label="Status" value={<StatusBadge status={sale.status} />} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Section with 3 Summary Cards */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle>Update Payment & Receipts</CardTitle>
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

          {/* 3 Summary Cards for Visual Balance Tracking */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg border bg-slate-50 dark:bg-slate-900 text-center">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase">Invoice Total</div>
              <div className="text-lg font-bold mt-1">{formatINR(sale.total)}</div>
            </div>
            <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
              <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Amount Received</div>
              <div className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mt-1">{formatINR(totalPaid)}</div>
            </div>
            <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 text-center">
              <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase">Pending Balance</div>
              <div className="text-lg font-bold text-rose-800 dark:text-rose-300 mt-1">{formatINR(pendingBalance)}</div>
            </div>
          </div>

          {editMode && (
            <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
              ⚠️ <strong>Correction Mode:</strong> This will <strong>replace</strong> the current total paid amount ({formatINR(totalPaid)}). Use this only to fix mistakes.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label={editMode ? "Correct Total Paid (₹)" : "Amount received now (₹)"}>
              <Input 
                type="number" 
                placeholder={editMode ? "Enter correct total" : `Max ${formatINR(pendingBalance)}`}
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
            <div className="flex items-end md:col-span-2 lg:col-span-1">
              <Button onClick={savePayment} className="w-full">
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
                      <TH className="py-2 text-right">Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {payments.map((p) => (
                      <TR key={p.id}>
                        <TD className="py-2 text-xs">{formatDate(p.date || p.createdAt)}</TD>
                        <TD className="py-2 text-xs font-medium">{p.method || p.paymentMethod || "Cash"}</TD>
                        <TD className="py-2 text-xs text-right font-semibold text-emerald-600">+ {formatINR(p.amount)}</TD>
                        <TD className="py-2 text-xs text-muted-foreground">{p.notes || "—"}</TD>
                        <TD className="py-2 text-right space-x-1">
                          <Button size="xs" variant="outline" onClick={() => deletePayment(p.id)} className="text-rose-600 border-rose-200 hover:bg-rose-50 h-7 text-xs">Delete</Button>
                        </TD>
                      </TR>
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
