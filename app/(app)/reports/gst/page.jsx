"use client";
import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { api, useCompany } from "@/components/company-context";
import { formatINR } from "@/lib/utils";
import { NoCompanySelected } from "@/components/empty-state";

export default function GstReportPage() {
  const { active } = useCompany();
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 7) + "-01");
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active?.id) { setLoading(false); return; }
    setLoading(true); setError("");
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    api(`/api/reports/gst?${params}`)
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message || "Could not load report"); setData(null); setLoading(false); });
  }, [active?.id, from, to]);

  if (!active) return <NoCompanySelected />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">GST report</h1>
        <Button 
          variant="outline" 
          className="gap-2"
          onClick={async () => {
            const data = await api("/api/reports/gst/export");
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `GSTR1_${active.gstNumber || 'export'}.json`;
            a.click();
          }}
        >
          <Download className="h-4 w-4" /> Export GSTR-1 JSON
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 md:grid-cols-2 p-4">
          <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="p-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Crunching numbers…
        </CardContent></Card>
      ) : error ? (
        <Card><CardContent className="p-8 space-y-3">
          <div className="flex items-center gap-2 text-rose-600 text-sm">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
          <Button size="sm" variant="outline" onClick={() => { setLoading(true); setError(""); setData(null); setFrom((s) => s); }}>Retry</Button>
        </CardContent></Card>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardHeader><CardTitle>Output GST (sales)</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <Row label="Taxable" value={formatINR(data.sales.taxable)} />
                <Row label="CGST" value={formatINR(data.sales.cgst)} />
                <Row label="SGST" value={formatINR(data.sales.sgst)} />
                <Row label="IGST" value={formatINR(data.sales.igst)} />
                <Row label={<strong>Total</strong>} value={<strong>{formatINR(data.sales.total)}</strong>} />
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle>Input GST (purchases)</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <Row label="Taxable" value={formatINR(data.purchases.taxable)} />
                <Row label="CGST" value={formatINR(data.purchases.cgst)} />
                <Row label="SGST" value={formatINR(data.purchases.sgst)} />
                <Row label="IGST" value={formatINR(data.purchases.igst)} />
                <Row label={<strong>Total</strong>} value={<strong>{formatINR(data.purchases.total)}</strong>} />
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle>Net GST payable</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatINR(data.netGstPayable)}
                <p className="text-xs text-muted-foreground font-normal mt-2">Output − Input across CGST + SGST + IGST.</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Sales-side breakup ({data.rows.length})</CardTitle></CardHeader>
            <CardContent>
              {data.rows.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4">
                  No sales in the selected period. Pick a wider date range or create an invoice.
                </div>
              ) : (
                <Table>
                  <THead><TR>
                    <TH>Date</TH><TH>Invoice</TH>
                    <TH className="text-right">Taxable</TH>
                    <TH className="text-right">CGST</TH><TH className="text-right">SGST</TH><TH className="text-right">IGST</TH>
                    <TH className="text-right">Total</TH>
                  </TR></THead>
                  <TBody>
                    {data.rows.map((r, i) => (
                      <TR key={i}>
                        <TD>{r.date}</TD><TD>{r.invoice}</TD>
                        <TD className="text-right">{formatINR(r.taxable)}</TD>
                        <TD className="text-right">{formatINR(r.cgst)}</TD>
                        <TD className="text-right">{formatINR(r.sgst)}</TD>
                        <TD className="text-right">{formatINR(r.igst)}</TD>
                        <TD className="text-right font-semibold">{formatINR(r.total)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
