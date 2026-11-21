"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ReportsNav } from "@/components/reports-nav";
import { PdfPreview } from "@/components/pdf-preview";
import { NoCompanySelected } from "@/components/empty-state";
import { useCompany, api } from "@/components/company-context";
import { formatINR, formatDate, cn } from "@/lib/utils";

const TABS = [
  { key: "customers", label: "Customers (receivable)", empty: "No customer owes you anything." },
  { key: "suppliers", label: "Suppliers (payable)", empty: "You owe no supplier anything." }
];

/** Outstanding statement for every customer or every supplier, with a printable PDF. */
export default function OutstandingPage() {
  const { active } = useCompany();
  const [party, setParty] = useState("customers");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  // Print preview of the outstanding PDF: { src, name } while open.
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!active?.id) return;
    setData(null); setError("");
    api(`/api/reports/outstanding?party=${party}`).then(setData).catch((e) => setError(e.message));
  }, [active?.id, party]);

  if (!active) return <NoCompanySelected />;
  const tab = TABS.find((t) => t.key === party);
  const who = party === "customers" ? "Customers" : "Suppliers";

  return (
    <div className="space-y-4">
      <ReportsNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Outstanding statement</h1>
          <p className="text-sm text-muted-foreground">Unpaid bills, party by party, with days pending.</p>
        </div>
        {data?.totalParties > 0 && (
          <Button className="gap-1.5" onClick={() => setPreview({ src: `/api/reports/outstanding/pdf?party=${party}&companyId=${active.id}`, name: `outstanding-${party}.pdf` })}>
              <FileDown className="h-4 w-4" />Print / Save PDF
            </Button>
        )}
      </div>

      <div className="flex gap-2" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={party === t.key} onClick={() => setParty(t.key)}
            className={cn("rounded-md border px-3 py-1.5 text-sm", party === t.key ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent")}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data && !error && <p className="text-sm text-muted-foreground">Loading…</p>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card><CardContent className="p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{who} with a balance</div>
              <div className="text-lg font-semibold">{data.totalParties}</div>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{party === "customers" ? "Total to receive" : "Total to pay"}</div>
              <div className="text-lg font-semibold text-amber-700">{formatINR(data.totalAmount)}</div>
            </CardContent></Card>
          </div>

          {data.parties.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{tab.empty}</CardContent></Card>
          ) : data.parties.map((p) => (
            <Card key={p.id}>
              <CardHeader className="py-2 border-b flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm uppercase tracking-wide">{p.name}</CardTitle>
                <Link className="text-xs text-primary hover:underline" href={`/reports/ledger?party=${party}&key=${encodeURIComponent(p.id)}`}>Full ledger →</Link>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <THead>
                    <TR>
                      <TH className="w-28">Date</TH>
                      <TH>{party === "customers" ? "Invoice no." : "Bill no."}</TH>
                      <TH className="text-right">Bill amount</TH>
                      <TH className="text-right">Paid</TH>
                      <TH className="text-right">Pending</TH>
                      <TH className="w-28">{party === "customers" ? "Due on" : "Bill date"}</TH>
                      <TH className="w-28 text-right">Days pending</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {p.rows.map((r, i) => (
                      <TR key={i}>
                        <TD>{formatDate(r.date)}</TD>
                        <TD className="font-mono">{r.refNo}</TD>
                        <TD className="text-right">{formatINR(r.billAmount)}</TD>
                        <TD className="text-right">{formatINR(r.paid)}</TD>
                        <TD className="text-right">{formatINR(r.pendingAmount)}</TD>
                        <TD>{formatDate(r.dueOn)}</TD>
                        <TD className={cn("text-right", r.overdueDays > 30 && "text-destructive font-semibold")}>{r.overdueDays || "—"}</TD>
                      </TR>
                    ))}
                    <TR className="bg-muted/40 font-semibold">
                      <TD colSpan={2}>Total</TD>
                      <TD className="text-right">{formatINR(p.rows.reduce((t, r) => t + r.billAmount, 0))}</TD>
                      <TD className="text-right">{formatINR(p.rows.reduce((t, r) => t + r.paid, 0))}</TD>
                      <TD className="text-right">{formatINR(p.totalPending)}</TD>
                      <TD colSpan={2} />
                    </TR>
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </>
      )}
      <PdfPreview src={preview?.src} fileName={preview?.name} onClose={() => setPreview(null)} />
    </div>
  );
}
