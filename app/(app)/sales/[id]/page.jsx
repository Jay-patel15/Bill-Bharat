"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Pencil, Printer, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaymentSection } from "@/components/payment-section";
import { PdfPreview } from "@/components/pdf-preview";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";
import { formatINR, formatDate, getDocumentType } from "@/lib/utils";
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
  // Print preview of the invoice PDF: { src, name } while open.
  const [preview, setPreview] = useState(null);

  // Set when the customer page opened this invoice to edit one payment.
  const [openPaymentId, setOpenPaymentId] = useState(null);

  async function load() {
    try {
      const data = await api(`/api/sales/${params.id}`);
      setSale(data);
      setItems(data.items || []);
      setPayments(data.payments || []);
      // Opened from the customer page: open that payment for editing (once, then clear the link).
      const editId = new URLSearchParams(window.location.search).get("editPayment");
      if (editId) {
        window.history.replaceState(null, "", window.location.pathname);
        setOpenPaymentId(editId);
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
  // Payment callbacks for the shared PaymentSection; each reloads the invoice afterwards.
  async function recordPayment(d) {
    await api(`/api/sales/${sale.id}/payments`, { method: "POST", body: JSON.stringify(d) });
    await load();
  }

  async function updatePayment(p, d) {
    await api(`/api/payments/${p.id}`, { method: "PUT", body: JSON.stringify(d) });
    await load();
  }

  async function deletePayment(id) {
    await api(`/api/payments/${id}`, { method: "DELETE" });
    await load();
  }

  /** Opens the print preview; the user prints it or saves it where they choose. */
  function printInvoice() {
    setPreview({ src: `/api/sales/${sale.id}/pdf`, name: `${sale.invoiceNumber || "invoice"}.pdf` });
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
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => router.push(`/sales/create-invoice?edit=${sale.id}`)} title="Change items, quantities, rates or dates">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
          <Button variant="outline" onClick={printInvoice} title="Print preview (Ctrl+P); save the PDF where you choose"><Printer className="h-4 w-4" /> Print / Save PDF</Button>
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

      <PaymentSection
        total={sale.total}
        payments={payments}
        startEditId={openPaymentId}
        onRecord={recordPayment}
        onUpdate={updatePayment}
        onDelete={deletePayment}
      />

      <PdfPreview src={preview?.src} fileName={preview?.name} onClose={() => setPreview(null)} />
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
