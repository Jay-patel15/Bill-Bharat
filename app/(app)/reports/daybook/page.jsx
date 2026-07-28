"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCompany, api } from "@/components/company-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, RefreshCw, Building, ArrowUpRight, ArrowDownLeft, ExternalLink } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { format } from "date-fns";

const OUT_CATEGORIES = [
  "Site Expense",
  "Labor / Wages",
  "Materials & Hardware",
  "Travel & Fuel",
  "Food & Refreshments",
  "Equipment & Machinery",
  "Rent & Utilities",
  "Office Expense",
  "Misc Expense"
];

const IN_CATEGORIES = [
  "Customer Payment",
  "Site Advance / Deposit",
  "Sales Income",
  "Owner / Capital Deposit",
  "Refund Received",
  "Other Income"
];

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque"];

export default function DayBookPage() {
  const { active } = useCompany();
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    entryType: "OUT", // "IN" or "OUT"
    date: new Date().toISOString().slice(0, 10),
    category: "Site Expense",
    projectId: "",
    customSiteName: "",
    amount: "",
    paymentMode: "Cash",
    description: ""
  });

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    Promise.all([
      api("/api/reports/daybook").catch(() => []),
      api("/api/projects").catch(() => [])
    ]).then(([dData, pData]) => {
      setEntries(dData || []);
      setProjects(pData || []);
    }).finally(() => {
      setLoading(false);
    });
  }, [active]);

  async function loadDayBook() {
    try {
      setLoading(true);
      const data = await api("/api/reports/daybook");
      setEntries(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects() {
    try {
      const data = await api("/api/projects");
      setProjects(data || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleEntrySubmit(e) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      setSaving(true);
      const selectedProj = projects.find((p) => p.id === form.projectId);
      const finalProjectName = form.projectId === "custom" 
        ? form.customSiteName 
        : (selectedProj ? selectedProj.name : "");

      await api("/api/reports/daybook", {
        method: "POST",
        body: JSON.stringify({
          entryType: form.entryType,
          date: form.date,
          category: form.category,
          amount: Number(form.amount),
          paymentMode: form.paymentMode,
          projectId: (form.projectId && form.projectId !== "custom") ? form.projectId : null,
          projectName: finalProjectName,
          description: form.description
        })
      });

      setShowModal(false);
      setForm({
        entryType: "OUT",
        date: new Date().toISOString().slice(0, 10),
        category: "Site Expense",
        projectId: "",
        customSiteName: "",
        amount: "",
        paymentMode: "Cash",
        description: ""
      });
      loadDayBook();
    } catch (err) {
      alert(err.message || "Failed to record entry");
    } finally {
      setSaving(false);
    }
  }

  const categoryOptions = form.entryType === "IN" ? IN_CATEGORIES : OUT_CATEGORIES;

  if (!active) return <div className="p-10 text-center">Select a company to view the Day Book.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Accounting Day Book (Rojmel / રોજમેળ)</h1>
          <p className="text-sm text-muted-foreground">Daily register of sales, purchases, cash in (Jama), cash out (Udhar), and site expenses.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="default"
            size="sm"
            onClick={() => setShowModal(true)}
            className="gap-1.5"
          >
            <PlusCircle className="h-4 w-4" />
            Add Manual Entry (IN / OUT)
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={async () => {
              try {
                const res = await api("/api/reports/daybook/sync", { method: "POST" });
                alert(`Sync Complete: ${res.synced?.length || 0} invoices synced.`);
                loadDayBook();
              } catch (e) {
                alert(e.message);
              }
            }}
            className="gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            Sync Invoices
          </Button>
        </div>
      </div>

      {/* Record IN/OUT Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg space-y-4 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-primary" />
                Record Day Book Entry (Rojmel)
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEntrySubmit} className="space-y-4">
              {/* Entry Type Toggle (IN vs OUT) */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Entry Type (Jama / Udhar)</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, entryType: "OUT", category: OUT_CATEGORIES[0] })}
                    className={`flex items-center justify-center gap-2 py-2 rounded-md font-semibold text-sm transition-all ${
                      form.entryType === "OUT" 
                        ? "bg-rose-600 text-white shadow" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    OUT (Money Spent / Expense)
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, entryType: "IN", category: IN_CATEGORIES[0] })}
                    className={`flex items-center justify-center gap-2 py-2 rounded-md font-semibold text-sm transition-all ${
                      form.entryType === "IN" 
                        ? "bg-emerald-600 text-white shadow" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ArrowDownLeft className="h-4 w-4" />
                    IN (Money Received / Income)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Date</label>
                  <Input 
                    type="date" 
                    value={form.date} 
                    onChange={(e) => setForm({ ...form, date: e.target.value })} 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Payment Mode</label>
                  <select 
                    value={form.paymentMode} 
                    onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
                    className="w-full h-10 px-3 border rounded-md bg-background text-sm"
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {form.entryType === "IN" ? "Income Category" : "Expense Category"}
                </label>
                <select 
                  value={form.category} 
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full h-10 px-3 border rounded-md bg-background text-sm"
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-muted-foreground" />
                    Site / Project (Respective Site)
                  </label>
                  <Link 
                    href="/projects" 
                    target="_blank" 
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    + Manage Sites <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                <select 
                  value={form.projectId} 
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                  className="w-full h-10 px-3 border rounded-md bg-background text-sm"
                >
                  <option value="">-- General / No Specific Site --</option>
                  <option value="custom">✏️ + Type Custom Site Name...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      🏢 {p.name}
                    </option>
                  ))}
                </select>

                {form.projectId === "custom" && (
                  <div className="mt-2">
                    <Input
                      placeholder="Type your site name (e.g. Surat Site, Highway Project)"
                      value={form.customSiteName}
                      onChange={(e) => setForm({ ...form, customSiteName: e.target.value })}
                      required
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Amount (₹)</label>
                <Input 
                  type="number" 
                  step="0.01"
                  placeholder="e.g. 5000" 
                  value={form.amount} 
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} 
                  required 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description / Particulars</label>
                <Input 
                  placeholder={form.entryType === "IN" ? "e.g. Received advance from client for site civil work" : "e.g. Paid cash for site labor & materials"} 
                  value={form.description} 
                  onChange={(e) => setForm({ ...form, description: e.target.value })} 
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className={form.entryType === "IN" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}>
                  {saving ? "Saving..." : `Save ${form.entryType === "IN" ? "IN (Jama)" : "OUT (Udhar)"} Entry`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Ledger Transactions (Debit/Credit)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center">Loading accounting entries...</div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No transactions recorded yet. Click &quot;Add Manual Entry (IN / OUT)&quot; or create a Sale/Purchase to see entries.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium">Particulars (Ledger Name)</th>
                    <th className="p-3 font-medium">Vch Type</th>
                    <th className="p-3 font-medium text-right">Debit (Dr - Udhar)</th>
                    <th className="p-3 font-medium text-right">Credit (Cr - Jama)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-muted/30 transition-colors border-b last:border-0">
                      <td className="p-3 whitespace-nowrap font-mono text-xs">{format(new Date(entry.date), "dd MMM yyyy")}</td>
                      <td className="p-3">
                        <div className="font-medium text-foreground">{entry.ledgerName}</div>
                        {entry.description && (
                          <div className="text-xs text-muted-foreground italic mt-0.5">{entry.description}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          entry.type === "RECEIPT" ? "bg-emerald-100 text-emerald-800 border border-emerald-300" :
                          entry.type === "EXPENSE" ? "bg-rose-100 text-rose-800 border border-rose-300" :
                          entry.type === "SALE" ? "bg-blue-100 text-blue-800" :
                          entry.type === "PURCHASE" ? "bg-amber-100 text-amber-800" :
                          "bg-secondary text-secondary-foreground"
                        }`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-blue-600 font-semibold">
                        {entry.debit > 0 ? formatINR(entry.debit) : ""}
                      </td>
                      <td className="p-3 text-right font-mono text-red-600 font-semibold">
                        {entry.credit > 0 ? formatINR(entry.credit) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
