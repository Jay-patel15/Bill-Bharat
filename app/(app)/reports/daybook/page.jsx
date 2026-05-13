"use client";
import { useEffect, useState } from "react";
import { useCompany, api } from "@/components/company-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/utils";
import { format } from "date-fns";

export default function DayBookPage() {
  const { active } = useCompany();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (active) loadDayBook();
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

  if (!active) return <div className="p-10 text-center">Select a company to view the Day Book.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounting Day Book</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Ledger Transactions (Debit/Credit)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center">Loading accounting entries...</div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No transactions recorded yet. Create a Sale or Journal to see entries here.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium">Particulars (Ledger Name)</th>
                    <th className="p-3 font-medium">Vch Type</th>
                    <th className="p-3 font-medium text-right">Debit (Dr)</th>
                    <th className="p-3 font-medium text-right">Credit (Cr)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-muted/30 transition-colors border-b last:border-0">
                      <td className="p-3 whitespace-nowrap">{format(new Date(entry.date), "dd MMM yyyy")}</td>
                      <td className="p-3">
                        <div className="font-medium text-foreground">{entry.ledgerName}</div>
                        <div className="text-[10px] text-muted-foreground italic">{entry.description}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary text-secondary-foreground uppercase">
                          {entry.type}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-blue-600">
                        {entry.debit > 0 ? formatINR(entry.debit) : ""}
                      </td>
                      <td className="p-3 text-right font-mono text-red-600">
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
