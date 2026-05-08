"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { api, useCompany } from "@/components/company-context";
import { formatDate, formatINR } from "@/lib/utils";
import { NoCompanySelected } from "@/components/empty-state";

export default function PurchasesPage() {
  const { active } = useCompany();
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (active?.id) api("/api/purchases").then(setList).catch(() => setList([]));
  }, [active?.id]);

  if (!active) return <NoCompanySelected />;

  const filtered = list.filter((p) =>
    [p.supplierName, p.billNumber, p.status].some((f) => (f || "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Purchases</h1>
          <p className="text-sm text-muted-foreground">Track supplier bills, GST input credit and payables.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/purchase/ai-upload">
            <Button variant="outline"><Sparkles className="h-4 w-4" /> AI upload</Button>
          </Link>
          <Link href="/purchase/create">
            <Button><Plus className="h-4 w-4" /> New purchase</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>All purchases ({filtered.length})</CardTitle>
          <Input placeholder="Search supplier, bill #…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4">No purchases yet.</div>
          ) : (
            <Table>
              <THead><TR>
                <TH>Bill #</TH><TH>Date</TH><TH>Supplier</TH>
                <TH className="text-right">Subtotal</TH><TH className="text-right">Tax</TH>
                <TH className="text-right">Total</TH><TH>Status</TH>
              </TR></THead>
              <TBody>
                {filtered.map((p) => {
                  const tax = Number(p.cgst || 0) + Number(p.sgst || 0) + Number(p.igst || 0);
                  return (
                    <TR key={p.id}>
                      <TD>{p.billNumber || "—"}</TD>
                      <TD>{formatDate(p.billDate)}</TD>
                      <TD className="font-medium">{p.supplierName}</TD>
                      <TD className="text-right">{formatINR(p.subtotal)}</TD>
                      <TD className="text-right">{formatINR(tax)}</TD>
                      <TD className="text-right font-semibold">{formatINR(p.total)}</TD>
                      <TD><StatusBadge status={p.status} /></TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
