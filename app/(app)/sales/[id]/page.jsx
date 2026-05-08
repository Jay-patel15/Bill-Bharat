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
  const [amountPaid, setAmountPaid] = useState(0);
  const [status, setStatus] = useState("");
  const [pdfLink, setPdfLink] = useState("");

  async function load() {
    const s = await api(`/api/sales/${params.id}`);
    setSale(s);
    setAmountPaid(Number(s.amountPaid) || 0);
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
      await api(`/api/sales/${sale.id}`, {
        method: "PUT", body: JSON.stringify({ amountPaid, status })
      });
      toast({ type: "success", title: "Saved" });
      await load();
    } catch (e) { toast({ type: "error", title: "Save failed", message: e.message }); }
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
            <Button variant="outline"><Download className="h-4 w-4" /> PDF</Button>
          </a>
          <Button variant="outline" onClick={persistPdf}><Save className="h-4 w-4" /> Save to Drive</Button>
          <Button variant="outline" onClick={shareWhatsApp}><Share2 className="h-4 w-4" /> WhatsApp</Button>
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
        <CardHeader><CardTitle>Update payment</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Amount received (₹)">
            <Input type="number" value={amountPaid} onChange={(e) => setAmountPaid(Number(e.target.value))} />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>Unpaid</option><option>Partially Paid</option><option>Paid</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button onClick={savePayment}>Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
