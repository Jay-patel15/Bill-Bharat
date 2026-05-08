"use client";
import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { FileDown, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api, useCompany } from "@/components/company-context";
import { formatINR } from "@/lib/utils";
import { NoCompanySelected } from "@/components/empty-state";

export default function FinanceReportPage() {
  const { active } = useCompany();
  const [data, setData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active?.id) { setLoading(false); return; }
    setLoading(true); setError("");
    Promise.all([
      api("/api/reports/dashboard"),
      api("/api/customers")
    ])
      .then(([d, c]) => { setData(d); setCustomers(c || []); setLoading(false); })
      .catch((e) => { setError(e.message || "Could not load"); setLoading(false); });
  }, [active?.id]);

  if (!active) return <NoCompanySelected />;
  if (loading) {
    return (
      <Card><CardContent className="p-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading finance overview…
      </CardContent></Card>
    );
  }
  if (error) {
    return (
      <Card><CardContent className="p-8 space-y-3">
        <div className="flex items-center gap-2 text-rose-600 text-sm">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
        <Button size="sm" variant="outline" onClick={() => { setLoading(true); setError(""); setData(null); setCustomers([]); }}>
          Retry
        </Button>
      </CardContent></Card>
    );
  }
  if (!data) {
    return (
      <Card><CardContent className="p-8 text-sm text-muted-foreground">
        No data available yet. Create an invoice or purchase to populate this view.
      </CardContent></Card>
    );
  }

  const { totals, monthly = [] } = data;
  const outstandingCustomers = customers
    .filter((c) => Number(c.outstanding) > 0)
    .sort((a, b) => Number(b.outstanding) - Number(a.outstanding));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Finance overview</h1>
        <a href={`/api/reports/export?type=customers`} target="_blank" rel="noreferrer">
          <Button variant="outline"><FileDown className="h-4 w-4" /> Export outstanding</Button>
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Sales" value={formatINR(totals.sales)} />
        <Stat label="Purchases" value={formatINR(totals.purchases)} />
        <Stat label="Profit" value={formatINR(totals.profit)} accent={totals.profit >= 0 ? "text-emerald-600" : "text-rose-600"} />
        <Stat label="Net working capital" value={formatINR(totals.receivable - totals.payable)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Cashflow trend</CardTitle></CardHeader>
        <CardContent style={{ height: 280 }}>
          {monthly.length === 0 ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">
              No data yet — record sales and purchases to populate the trend.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Line dataKey="sales" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line dataKey="purchases" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Customer outstanding</CardTitle></CardHeader>
        <CardContent>
          {outstandingCustomers.length === 0 ? (
            <div className="text-sm text-muted-foreground">All paid up.</div>
          ) : (
            <Table>
              <THead><TR><TH>Customer</TH><TH>GSTIN</TH><TH className="text-right">Credit limit</TH><TH className="text-right">Outstanding</TH></TR></THead>
              <TBody>
                {outstandingCustomers.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.name}</TD>
                    <TD>{c.gstNumber || "—"}</TD>
                    <TD className="text-right">{formatINR(c.creditLimit)}</TD>
                    <TD className="text-right font-semibold">{formatINR(c.outstanding)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase text-muted-foreground tracking-wide">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${accent || ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
