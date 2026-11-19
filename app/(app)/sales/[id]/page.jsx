"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Pencil, Printer, Save, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";
import { formatINR, formatDate, getDocumentType, parseInvoiceNotes } from "@/lib/utils";
import { isGstCompany } from "@/lib/gst";
import { navReplace } from "@/components/back-handler";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Message sent with the invoice PDF: "Dear <party>, your invoice generated on 27-Feb-23, Invoice No …, Amount … Dr, <company>, Regards." */
function invoiceMessage({ sale, partyName, companyName }) {
  const [y, m, d] = String(sale.invoiceDate || "").slice(0, 10).split("-");
  const date = d && m && y ? `${d}-${MONTHS[Number(m) - 1]}-${y.slice(2)}` : "";
  const amount = Number(sale.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `Dear ${partyName}, your invoice generated on ${date}, Invoice No ${sale.invoiceNumber}, Amount ${amount} Dr, ${companyName}, Regards.`;
}

/** WhatsApp needs the country code; a bare 10-digit Indian mobile number gets 91. */
function whatsappNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

export default function SaleDetailPage({ params }) {
  const router = useRouter();
  const toast = useToast();
  const { active } = useCompany();
  const gstOn = isGstCompany(active);

  const [sale, setSale] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [items, setItems] = useState([]);
  const [payments, setPayments] = useState([]);
  const [pdfLink, setPdfLink] = useState("");

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [payRef, setPayRef] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [payNotes, setPayNotes] = useState("");
  const payInput = useRef(null);

  async function load() {
    try {
      const data = await api(`/api/sales/${params.id}`);
      setSale(data);
      setItems(data.items || []);
      setPayments(data.payments || []);
      // Opened from the customer page: load that payment into the Record Payment box.
      const editId = new URLSearchParams(window.location.search).get("editPayment");
      if (editId) {
        window.history.replaceState(null, "", window.location.pathname);
        const p = (data.payments || []).find((x) => x.id === editId);
        if (p) startEditPayment(p);
      }
      if (data.pdfUrl) setPdfLink(data.pdfUrl);
      else if (data.notes) {
        // Legacy invoices stored the saved-PDF link inside notes metadata.
        const { drivePdfUrl } = parseInvoiceNotes(data.notes);
        if (drivePdfUrl) setPdfLink(drivePdfUrl);
      }
      if (data.customerId) {
        try { setCustomer(await api(`/api/customers/${data.customerId}`)); } catch {}
      }
    } catch (e) {
      toast({ type: "error", title: "Could not load", message: e.message });
      navReplace(router, "/sales");
    }
  }

  useEffect(() => { if (active?.id) load(); }, [params.id, active?.id]);

  // Ctrl+P (browser) and the Electron Print menu (app-print event) both print the invoice directly.
  useEffect(() => {
    if (!sale) return;
    const onPrint = (e) => { e.preventDefault(); printInvoice(); };
    const onKey = (e) => { if (e.ctrlKey && e.key.toLowerCase() === "p") onPrint(e); };
    window.addEventListener("app-print", onPrint);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("app-print", onPrint); window.removeEventListener("keydown", onKey); };
  }, [sale]);

  if (!sale) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const interstate = sale.supplierStateCode && sale.recipientStateCode && sale.supplierStateCode !== sale.recipientStateCode;
  // Only unpaid invoices can be edited (a document that takes payments and has money against it is locked).
  const canEdit = !(getDocumentType(sale.documentType).affectsOutstanding && Number(sale.amountPaid) > 0);
  
  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pendingBalance = Math.max(0, Number(sale.total || 0) - totalPaid);
  // Amount entered above what is still pending (not used when correcting the total).
  // While editing a payment, the room left is the total minus every other payment.
  const editingPay = payments.find((p) => p.id === editingId);
  const available = editingPay ? Math.max(0, Number(sale.total || 0) - (totalPaid - Number(editingPay.amount))) : pendingBalance;
  const overBy = Number(payAmount) > available ? Math.round((Number(payAmount) - available) * 100) / 100 : 0;

  function startEditPayment(p) {
    setEditingId(p.id);
    setPayAmount(String(p.amount));
    setPayMethod(p.method || "Cash");
    setPayRef("");
    setPayNotes(p.notes || "");
    payInput.current?.focus();
  }

  function cancelEdit() {
    setEditingId(null);
    setPayAmount("");
    setPayRef("");
    setPayNotes("");
  }

  async function savePayment(acceptExcess = false) {
    if (!payAmount || Number(payAmount) <= 0) {
      toast({ type: "error", title: "Invalid amount", message: "Please enter a valid payment amount." });
      return;
    }
    // More than the pending amount needs an explicit choice: re-edit, or ignore and record it.
    if (Number(payAmount) > available && !acceptExcess) return;
    if (editingPay) {
      try {
        await api(`/api/payments/${editingPay.id}`, {
          method: "PUT",
          body: JSON.stringify({
            amount: Number(payAmount),
            method: payMethod,
            notes: payNotes
          })
        });
        toast({ type: "success", title: "Payment updated" });
        cancelEdit();
        await load();
      } catch (e) {
        toast({ type: "error", title: "Failed to update payment", message: e.message });
      }
      return;
    }
    try {
      await api(`/api/sales/${sale.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(payAmount),
          method: payMethod,
          notes: payRef ? `${payMethod} Ref: ${payRef}` : `Payment for ${sale.invoiceNumber}`
        })
      });
      toast({ type: "success", title: "Payment recorded successfully" });
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

  /** Print the invoice PDF straight from a hidden frame, no download or new tab. */
  async function printInvoice() {
    try {
      const res = await fetch(`/api/sales/${sale.id}/pdf`);
      if (!res.ok) throw new Error("Could not build the PDF");
      const frame = document.createElement("iframe");
      frame.style.display = "none";
      frame.src = URL.createObjectURL(await res.blob());
      frame.onload = () => { frame.contentWindow.focus(); frame.contentWindow.print(); };
      document.body.appendChild(frame);
    } catch (e) { toast({ type: "error", title: "Could not print", message: e.message }); }
  }

  async function persistPdf() {
    try {
      toast({ type: "info", title: "Saving invoice PDF…" });
      const res = await fetch(`/api/sales/${sale.id}/pdf?save=1`);
      const json = await res.json();
      if (json.ok && json.pdfUrl) {
        setPdfLink(json.pdfUrl);
        toast({ type: "success", title: "PDF saved", message: json.pdfUrl });
      } else throw new Error(json.error || "Failed to save");
    } catch (e) { toast({ type: "error", title: "Could not save PDF", message: e.message }); }
  }

  /**
   * Send the invoice PDF. Where the device offers its share sheet (phones, Chrome), the PDF is attached
   * directly and the user picks WhatsApp, Gmail or any app. Otherwise the PDF is downloaded and the
   * WhatsApp chat or mail draft opens, and the user attaches the downloaded file.
   */
  async function sharePdf(channel) {
    let file;
    try {
      const res = await fetch(`/api/sales/${sale.id}/pdf`);
      if (!res.ok) throw new Error("Could not build the PDF");
      file = new File([await res.blob()], `${sale.invoiceNumber || "invoice"}.pdf`, { type: "application/pdf" });
    } catch (e) {
      return toast({ type: "error", title: "Could not get the PDF", message: e.message });
    }

    const subject = `Invoice No ${sale.invoiceNumber}`;
    const body = invoiceMessage({ sale, partyName: customer?.name || "Customer", companyName: active?.name || "" });

    // The desktop app never uses the share sheet: its native sheet can stay open with no way to finish.
    const desktopApp = /Electron\//.test(navigator.userAgent);
    if (!desktopApp && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: subject, text: body });
        return;
      } catch (e) {
        if (e.name === "AbortError") return; // the user closed the share sheet
        // any other failure: fall back to download and the chat or mail window
      }
    }

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    if (channel === "whatsapp") {
      window.open(`https://wa.me/${whatsappNumber(customer?.phone)}?text=${encodeURIComponent(body)}`, "_blank");
    } else {
      window.open(`mailto:${customer?.email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
    }
    toast({ type: "info", title: "PDF downloaded", message: "Attach the downloaded PDF to the message." });
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
          {canEdit && (
            <Button variant="outline" onClick={() => router.push(`/sales/create-invoice?edit=${sale.id}`)} title="Change items, quantities, rates or dates">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
          <Button variant="outline" onClick={printInvoice} title="Print invoice (Ctrl+P)"><Printer className="h-4 w-4" /> Print</Button>
          <Button variant="outline" onClick={persistPdf} title="Save a copy of the invoice PDF"><Save className="h-4 w-4" /> Save PDF</Button>
          <Button variant="outline" onClick={() => sharePdf("whatsapp")} title="Send the invoice PDF on WhatsApp"><Share2 className="h-4 w-4" /> WhatsApp</Button>
          <Button variant="outline" onClick={() => sharePdf("email")} title="Send the invoice PDF by email"><Mail className="h-4 w-4" /> Email</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Items</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Item</TH><TH>HSN</TH><TH className="text-right">Qty</TH><TH>Unit</TH>
                  <TH className="text-right">Rate</TH>{gstOn && <TH className="text-right">Tax</TH>}
                  <TH className="text-right">Total</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((it, i) => (
                  <TR key={i}>
                    <TD>{it.name}</TD>
                    <TD>{it.hsnCode || "—"}</TD>
                    <TD className="text-right">{it.quantity}</TD>
                    <TD>{it.unit || "PCS"}</TD>
                    <TD className="text-right">{formatINR(it.sellingPrice)}</TD>
                    {gstOn && <TD className="text-right">{formatINR((it.cgst || 0) + (it.sgst || 0) + (it.igst || 0))}</TD>}
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
            {gstOn && (interstate
              ? <Row label="IGST" value={formatINR(sale.igst)} />
              : (<><Row label="CGST" value={formatINR(sale.cgst)} /><Row label="SGST" value={formatINR(sale.sgst)} /></>))}
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
        <CardHeader className="pb-3">
          <CardTitle>Update Payment & Receipts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* 3 Summary Cards for Visual Balance Tracking */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg border bg-slate-50 text-center">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase">Invoice Total</div>
              <div className="text-lg font-bold mt-1">{formatINR(sale.total)}</div>
            </div>
            <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/50 text-center">
              <div className="text-[11px] font-semibold text-emerald-700 uppercase">Amount Received</div>
              <div className="text-lg font-bold text-emerald-800 mt-1">{formatINR(totalPaid)}</div>
            </div>
            <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/50 text-center">
              <div className="text-[11px] font-semibold text-rose-700 uppercase">Pending Balance</div>
              <div className="text-lg font-bold text-rose-800 mt-1">{formatINR(pendingBalance)}</div>
            </div>
          </div>

          {overBy > 0 && (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded p-3 space-y-2">
              <div>
                ⚠️ <strong>{formatINR(payAmount)}</strong> is more than the pending <strong>{formatINR(pendingBalance)}</strong>:
                {" "}<strong>{formatINR(overBy)}</strong> extra. Re-edit the amount, or ignore and record it as it is.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { payInput.current?.focus(); payInput.current?.select(); }}>Re-edit amount</Button>
                <Button size="sm" variant="outline" onClick={() => savePayment(true)}>Ignore and record anyway</Button>
              </div>
            </div>
          )}

          {editingPay && (
            <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded p-2 flex items-center justify-between gap-2">
              <span>Editing a payment of {formatINR(editingPay.amount)} ({editingPay.method || "Cash"}). Change the amount or method, then save.</span>
              <button className="underline whitespace-nowrap" onClick={cancelEdit}>Cancel edit</button>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Amount received now (₹)">
              <Input
                ref={payInput}
                type="number" 
                placeholder={`Max ${formatINR(available)}`}
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
            {!editingPay && payMethod !== "Cash" && payMethod !== "Bank Transfer" && (
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
            {editingPay && (
              <div className="md:col-span-2">
                <Field label="Notes">
                  <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
                </Field>
              </div>
            )}
            <div className="flex items-end md:col-span-2 lg:col-span-1">
              <Button onClick={() => savePayment()} disabled={overBy > 0} className="w-full">
                {editingPay ? "Save Payment Changes" : "Record Payment"}
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
                          <Button size="xs" variant="outline" onClick={() => startEditPayment(p)} className="h-7 text-xs">Edit</Button>
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
