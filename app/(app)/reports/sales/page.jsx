"use client";
import { useEffect, useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api, useCompany } from "@/components/company-context";
import { formatINR, formatDate } from "@/lib/utils";
import { NoCompanySelected } from "@/components/empty-state";

export default function SalesReportPage() {
  const { active } = useCompany();
  const [list, setList] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (active?.id) api("/api/sales").then(setList).catch(() => setList([]));
  }, [active?.id]);

  const filtered = useMemo(() => list.filter((s) => {
    if (from && s.invoiceDate < from) return false;
    if (to && s.invoiceDate > to) return false;
    return true;
  }), [list, from, to]);

  const totals = filtered.reduce((t, s) => ({
    subtotal: t.subtotal + Number(s.subtotal || 0),
    tax: t.tax + Number(s.cgst || 0) + Number(s.sgst || 0) + Number(s.igst || 0),
    total: t.total + Number(s.total || 0)
  }), { subtotal: 0, tax: 0, total: 0 });

  if (!active) return <NoCompanySelected />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Sales report</h1>
        <a href={`/api/reports/export?type=sales`} target="_blank" rel="noreferrer">
          <Button variant="outline"><FileDown className="h-4 w-4" /> Export Excel</Button>
        </a>
      </div>

      <Card>
        <CardContent className="grid gap-4 md:grid-cols-3 p-4">
          <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <div className="grid grid-cols-3 items-end gap-2">
            <SummaryStat label="Subtotal" value={formatINR(totals.subtotal)} />
            <SummaryStat label="Tax" value={formatINR(totals.tax)} />
            <SummaryStat label="Total" value={formatINR(totals.total)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{filtered.length} invoices</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead><TR>
              <TH>Invoice</TH><TH>Date</TH>
              <TH className="text-right">Subtotal</TH>
              <TH className="text-right">CGST</TH>
              <TH className="text-right">SGST</TH>
              <TH className="text-right">IGST</TH>
              <TH className="text-right">Total</TH>
            </TR></THead>
            <TBody>
              {filtered.map((s) => (
                <TR key={s.id}>
                  <TD>{s.invoiceNumber}</TD>
                  <TD>{formatDate(s.invoiceDate)}</TD>
                  <TD className="text-right">{formatINR(s.subtotal)}</TD>
                  <TD className="text-right">{formatINR(s.cgst)}</TD>
                  <TD className="text-right">{formatINR(s.sgst)}</TD>
                  <TD className="text-right">{formatINR(s.igst)}</TD>
                  <TD className="text-right font-semibold">{formatINR(s.total)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryStat({ label, value }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
