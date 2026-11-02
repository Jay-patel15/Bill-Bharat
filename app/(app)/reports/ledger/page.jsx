"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ReportsNav } from "@/components/reports-nav";
import { NoCompanySelected } from "@/components/empty-state";
import { useCompany, api } from "@/components/company-context";
import { formatINR, formatDate, cn } from "@/lib/utils";

/**
 * Party ledger: for one customer or supplier, bills and payments with running
 * balance. Covers all their invoices, or only the ones ticked.
 */
export default function LedgerPage() {
  const { active } = useCompany();
  const router = useRouter();
  const q = useSearchParams();
  const party = q.get("party") === "suppliers" ? "suppliers" : "customers";
  const key = q.get("key") || "";
  const [range, setRange] = useState({ from: q.get("from") || "", to: q.get("to") || "" });
  const ids = q.get("ids") || "";
  const [parties, setParties] = useState([]);
  const [st, setSt] = useState(null);
  const [error, setError] = useState("");

  const go = (patch) => {
    const next = new URLSearchParams({ party, key, ids, ...range, ...patch });
    for (const [k, v] of [...next.entries()]) if (!v) next.delete(k);
    router.replace(`/reports/ledger?${next}`);
  };

  useEffect(() => {
    if (!active?.id) return;
    api(`/api/reports/ledger?party=${party}`).then(setParties).catch((e) => setError(e.message));
  }, [active?.id, party]);

  useEffect(() => {
    setSt(null); setError("");
    if (!active?.id || !key) return;
    const p = new URLSearchParams({ party, key, from: q.get("from") || "", to: q.get("to") || "", ids });
    api(`/api/reports/ledger?${p}`).then(setSt).catch((e) => setError(e.message));
  }, [active?.id, party, key, ids, q]);

  if (!active) return <NoCompanySelected />;
  const supplier = party === "suppliers";
  const pdfHref = st && `/api/reports/ledger/pdf?${new URLSearchParams({ party, key, from: st.from, to: st.to, ids: st.ids.join(","), companyId: active.id })}`;
  const chosen = new Set(st?.ids || []);
  const toggle = (id) => {
    const next = new Set(chosen);
    next.has(id) ? next.delete(id) : next.add(id);
    go({ ids: [...next].join(",") });
  };

  return (
    <div className="space-y-4">
      <ReportsNav />
      <div>
        <h1 className="text-xl font-semibold">Party ledger</h1>
        <p className="text-sm text-muted-foreground">Detailed ledger of one party: every bill and payment with running balance. Tick invoices to limit it to those.</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">Type
          <Select value={party} onChange={(e) => go({ party: e.target.value, key: "", ids: "" })}>
            <option value="customers">Customer</option>
            <option value="suppliers">Supplier</option>
          </Select>
        </label>
        <label className="text-xs min-w-[240px] flex-1">{supplier ? "Supplier" : "Customer"}
          <Select value={key} onChange={(e) => go({ key: e.target.value, ids: "" })}>
            <option value="">Choose…</option>
            {parties.map((p) => <option key={p.key} value={p.key}>{p.name} ({formatINR(p.balance)} due)</option>)}
          </Select>
        </label>
        <label className="text-xs">From<Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
        <label className="text-xs">To<Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
        <Button variant="outline" onClick={() => go({})}>Show</Button>
        {pdfHref && <a href={pdfHref} target="_blank" rel="noreferrer"><Button className="gap-1.5"><FileDown className="h-4 w-4" />PDF</Button></a>}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!key && !error && <p className="text-sm text-muted-foreground">Choose a {supplier ? "supplier" : "customer"} to see their statement.</p>}

      {st && (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[["Opening", st.opening], [supplier ? "Billed" : "Invoiced", st.debitTotal], [supplier ? "Paid" : "Received", st.creditTotal],
              [supplier ? "Payable" : "Receivable", st.closing]].map(([label, v]) => (
              <Card key={label}><CardContent className="p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
                <div className="text-lg font-semibold">{formatINR(v)}</div>
              </CardContent></Card>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground">{supplier ? "Bills" : "Invoices"}:</span>
            <button onClick={() => go({ ids: "" })}
              className={cn("rounded-md border px-2.5 py-1", chosen.size === 0 ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent")}>
              All ({st.invoices.length})
            </button>
            {st.invoices.map((b) => (
              <label key={b.id} className={cn("flex items-center gap-1.5 rounded-md border px-2.5 py-1 cursor-pointer", chosen.has(b.id) && "border-primary bg-primary/10")}>
                <input type="checkbox" checked={chosen.has(b.id)} onChange={() => toggle(b.id)} />
                <span className="font-mono">{b.refNo}</span>
                <span className="text-xs text-muted-foreground">{formatINR(b.amount)}</span>
              </label>
            ))}
          </div>

            <Table>
              <THead><TR>
                <TH className="w-28">Date</TH><TH>Particulars</TH><TH>Ref. no.</TH>
                <TH className="text-right">{supplier ? "Bill" : "Debit"}</TH><TH className="text-right">{supplier ? "Paid" : "Credit"}</TH><TH className="text-right">Balance</TH>
              </TR></THead>
              <TBody>
                <TR className="bg-muted/40"><TD /><TD colSpan={4}>Opening balance</TD><TD className="text-right">{formatINR(st.opening)}</TD></TR>
                {st.ledger.map((e, i) => (
                  <TR key={i}>
                    <TD>{formatDate(e.date)}</TD><TD>{e.particulars}</TD><TD className="font-mono">{e.refNo}</TD>
                    <TD className="text-right">{e.debit ? formatINR(e.debit) : ""}</TD>
                    <TD className="text-right">{e.credit ? formatINR(e.credit) : ""}</TD>
                    <TD className="text-right font-medium">{formatINR(e.balance)}</TD>
                  </TR>
                ))}
                <TR className="bg-muted/40 font-semibold">
                  <TD /><TD colSpan={2}>Closing balance</TD>
                  <TD className="text-right">{formatINR(st.debitTotal)}</TD><TD className="text-right">{formatINR(st.creditTotal)}</TD>
                  <TD className="text-right">{formatINR(st.closing)}</TD>
                </TR>
              </TBody>
            </Table>
        </>
      )}
    </div>
  );
}
