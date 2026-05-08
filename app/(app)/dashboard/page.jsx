"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
  LineChart, Line
} from "recharts";
import { ArrowUpRight, IndianRupee, Receipt, Wallet, AlertTriangle, FolderKanban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api, useCompany } from "@/components/company-context";
import { formatINR } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/progress-bar";

export default function DashboardPage() {
  const { active, companies } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    api("/api/reports/dashboard").then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [active?.id]);

  if (companies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Welcome to BillBharat</CardTitle>
          <CardDescription>Create your first company to start invoicing.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/companies/create"><Button>Create company</Button></Link>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card><CardContent className="p-8 text-sm text-muted-foreground">Loading dashboard…</CardContent></Card>
    );
  }
  if (!data) {
    return (
      <Card><CardContent className="p-8 text-sm text-muted-foreground">
        No activity yet — create an invoice or record a purchase to populate the dashboard.
      </CardContent></Card>
    );
  }

  const { totals, monthly, lowStock, recentSales, projects = [] } = data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Sales" value={formatINR(totals.sales)} icon={IndianRupee} accent="text-emerald-600" />
        <StatCard title="Total Purchases" value={formatINR(totals.purchases)} icon={Receipt} accent="text-blue-600" />
        <StatCard title="Receivable" value={formatINR(totals.receivable)} icon={Wallet} accent="text-amber-600" />
        <StatCard title="Payable" value={formatINR(totals.payable)} icon={ArrowUpRight} accent="text-rose-600" />
      </div>

      {totals.projects > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Active projects" value={`${totals.activeProjects} / ${totals.projects}`} icon={FolderKanban} accent="text-indigo-600" />
          <StatCard title="Contract value" value={formatINR(totals.contractValue)} icon={IndianRupee} accent="text-slate-600" />
          <StatCard title="Billed against contracts" value={formatINR(totals.billedAgainstContracts)} icon={Receipt} accent="text-sky-600" />
          <StatCard title="Collected against contracts" value={formatINR(totals.collectedAgainstContracts)} icon={Wallet} accent="text-emerald-600" />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales vs Purchases</CardTitle>
            <CardDescription>Last 12 months</CardDescription>
          </CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Bar dataKey="sales" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchases" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profit Trend</CardTitle>
            <CardDescription>Sales − Purchases</CardDescription>
          </CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly.map((m) => ({ month: m.month, profit: m.sales - m.purchases }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Line dataKey="profit" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {projects.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><FolderKanban className="h-4 w-4 text-indigo-600" /> Project progress</CardTitle>
            <Link href="/projects" className="text-sm text-primary hover:underline">All projects →</Link>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block rounded-md border p-3 hover:bg-accent transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.code || "—"}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold">{formatINR(p.contractValue)}</div>
                    <div className="text-[11px] text-muted-foreground">contract</div>
                  </div>
                </div>
                <div className="mt-3 mb-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>Billed {p.billedPercent}%</span>
                  <span>Collected {p.collectedPercent}%</span>
                </div>
                <ProgressBar billed={p.billedPercent} collected={p.collectedPercent} />
                <div className="mt-2 grid grid-cols-3 text-xs text-muted-foreground">
                  <span>Billed: <span className="text-foreground font-medium">{formatINR(p.billed)}</span></span>
                  <span>Pending: <span className="text-amber-600 font-medium">{formatINR(p.pending)}</span></span>
                  <span className="text-right">Remaining: <span className="text-foreground font-medium">{formatINR(p.remaining)}</span></span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentSales.length === 0 ? (
              <div className="text-sm text-muted-foreground">No invoices yet.</div>
            ) : recentSales.map((s) => (
              <Link key={s.id} href={`/sales/${s.id}`} className="flex items-center justify-between p-2 rounded hover:bg-accent">
                <div>
                  <div className="font-medium">{s.invoiceNumber}</div>
                  <div className="text-xs text-muted-foreground">{s.invoiceDate}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatINR(s.total)}</div>
                  <StatusBadge status={s.status} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Low stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStock.length === 0 ? (
              <div className="text-sm text-muted-foreground">All stock looks healthy.</div>
            ) : lowStock.map((i) => (
              <div key={i.id} className="flex items-center justify-between p-2 rounded hover:bg-accent">
                <div>
                  <div className="font-medium">{i.name}</div>
                  <div className="text-xs text-muted-foreground">SKU: {i.sku || "—"}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold text-amber-600">{i.quantity}</div>
                  <div className="text-xs text-muted-foreground">≤ {i.lowStockThreshold}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, accent }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{title}</div>
          <div className="text-2xl font-semibold mt-1">{value}</div>
        </div>
        <div className={`p-3 rounded-full bg-muted ${accent}`}><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  );
}
