"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileDown, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { api, useCompany } from "@/components/company-context";
import { formatINR, formatDate, DOCUMENT_TYPES } from "@/lib/utils";
import { NoCompanySelected } from "@/components/empty-state";

export default function SalesPage() {
  const { active } = useCompany();
  const router = useRouter();
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (active?.id) api("/api/sales").then(setList).catch(() => setList([]));
  }, [active?.id]);

  const filtered = useMemo(() => list.filter((s) => {
    if (typeFilter !== "all" && (s.documentType || "Tax Invoice") !== typeFilter) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    return [s.invoiceNumber, s.status, s.documentType]
      .some((f) => (f || "").toLowerCase().includes(search.toLowerCase()));
  }), [list, search, typeFilter, statusFilter]);

  if (!active) return <NoCompanySelected />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sales documents</h1>
          <p className="text-sm text-muted-foreground">Tax invoices, proforma, purchase orders, delivery challans.</p>
        </div>
        <div className="relative">
          <Button onClick={() => setShowCreate((s) => !s)}>
            <Plus className="h-4 w-4" /> New <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          {showCreate ? (
            <div className="absolute right-0 mt-2 w-64 bg-background border rounded-md shadow-lg p-1 z-30" onMouseLeave={() => setShowCreate(false)}>
              {DOCUMENT_TYPES.map((t) => (
                <Link
                  key={t.value}
                  href={`/sales/create-invoice?type=${encodeURIComponent(t.value)}`}
                  className="block px-3 py-2 text-sm rounded hover:bg-accent"
                  onClick={() => setShowCreate(false)}
                >
                  <div className="font-medium">{t.value}</div>
                  <div className="text-xs text-muted-foreground">{t.prefix}-… · {t.taxable ? "with GST" : "non-taxable"}</div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle>All documents ({filtered.length})</CardTitle>
          <div className="flex gap-2">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="max-w-[180px]">
              <option value="all">All types</option>
              {DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.value}</option>)}
            </Select>
            <Input placeholder="Search number, status…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4">No documents yet.</div>
          ) : (
            <Table>
              <THead><TR>
                <TH>Number</TH><TH>Type</TH><TH>Date</TH>
                <TH className="text-right">Subtotal</TH>
                <TH className="text-right">Tax</TH><TH className="text-right">Total</TH>
                <TH>Status</TH><TH /></TR></THead>
              <TBody>
                {filtered.map((s) => {
                  const tax = Number(s.cgst || 0) + Number(s.sgst || 0) + Number(s.igst || 0);
                  return (
                    <TR key={s.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <TD className="font-medium" onClick={() => router.push(`/sales/${s.id}`)}>{s.invoiceNumber}</TD>
                      <TD onClick={() => router.push(`/sales/${s.id}`)}><Badge variant="outline">{s.documentType || "Tax Invoice"}</Badge></TD>
                      <TD onClick={() => router.push(`/sales/${s.id}`)}>{formatDate(s.invoiceDate)}</TD>
                      <TD className="text-right" onClick={() => router.push(`/sales/${s.id}`)}>{formatINR(s.subtotal)}</TD>
                      <TD className="text-right" onClick={() => router.push(`/sales/${s.id}`)}>{formatINR(tax)}</TD>
                      <TD className="text-right font-semibold" onClick={() => router.push(`/sales/${s.id}`)}>{formatINR(s.total)}</TD>
                      <TD onClick={() => router.push(`/sales/${s.id}`)}><StatusBadge status={s.status} /></TD>
                      <TD className="text-right">
                        <a
                          href={`/api/sales/${s.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Download Invoice PDF"
                        >
                          <Button size="sm" variant="outline" className="gap-1.5 px-4">
                            <FileDown className="h-3.5 w-3.5" />
                            <span>Download PDF</span>
                          </Button>
                        </a>
                      </TD>
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
