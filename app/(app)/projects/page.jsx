"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, FolderKanban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/progress-bar";
import { api, useCompany } from "@/components/company-context";
import { formatINR, formatDate } from "@/lib/utils";
import { NoCompanySelected } from "@/components/empty-state";

const STATUSES = ["All", "Active", "On Hold", "Completed", "Cancelled"];
const statusVariant = {
  Active: "success", "On Hold": "warning", Completed: "secondary", Cancelled: "danger"
};

export default function ProjectsPage() {
  const { active } = useCompany();
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    if (!active?.id) { setList([]); return; }
    api("/api/projects").then(setList).catch(() => setList([]));
    api("/api/customers").then(setCustomers).catch(() => setCustomers([]));
    api("/api/sales").then(setSales).catch(() => setSales([]));
  }, [active?.id]);

  const enriched = useMemo(() => {
    return list.map((p) => {
      const linked = sales.filter((s) => s.projectId === p.id && (s.documentType || "Tax Invoice") === "Tax Invoice");
      const billed = linked.reduce((t, s) => t + Number(s.total || 0), 0);
      const collected = linked.reduce((t, s) => t + Number(s.amountPaid || 0), 0);
      const cv = Number(p.contractValue || 0);
      return {
        ...p,
        billed,
        collected,
        pending: Math.max(0, billed - collected),
        remaining: Math.max(0, cv - billed),
        billedPercent: cv ? Math.min(100, Math.round((billed / cv) * 100)) : 0,
        collectedPercent: cv ? Math.min(100, Math.round((collected / cv) * 100)) : 0,
        customerName: customers.find((c) => c.id === p.customerId)?.name || "—"
      };
    });
  }, [list, sales, customers]);

  const filtered = enriched.filter((p) => {
    if (statusFilter !== "All" && (p.status || "Active") !== statusFilter) return false;
    return [p.name, p.code, p.customerName].some((f) => (f || "").toLowerCase().includes(search.toLowerCase()));
  });

  if (!active) return <NoCompanySelected />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FolderKanban className="h-5 w-5" /> Projects
          </h1>
          <p className="text-sm text-muted-foreground">Bill-of-Quantity-driven projects. Track billed vs collected vs remaining contract value.</p>
        </div>
        <Link href="/projects/create"><Button><Plus className="h-4 w-4" /> New project</Button></Link>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle>All projects ({filtered.length})</CardTitle>
          <div className="flex gap-2">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[160px]">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Input placeholder="Search name, code, customer…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No projects yet. <Link href="/projects/create" className="text-primary underline">Create your first project →</Link>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.code ? `${p.code} · ` : ""}{p.customerName}
                          </div>
                        </div>
                        <Badge variant={statusVariant[p.status] || "secondary"}>{p.status || "Active"}</Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <Row label="Contract" value={formatINR(p.contractValue)} bold />
                        <Row label="Billed" value={`${formatINR(p.billed)} (${p.billedPercent}%)`} />
                        <Row label="Collected" value={formatINR(p.collected)} accent="text-emerald-600" />
                        <Row label="Pending" value={formatINR(p.pending)} accent="text-amber-600" />
                      </div>
                      <ProgressBar billed={p.billedPercent} collected={p.collectedPercent} />
                      {p.endDate ? (
                        <div className="text-[11px] text-muted-foreground">Ends {formatDate(p.endDate)}</div>
                      ) : null}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, accent, bold }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${accent || ""} ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

