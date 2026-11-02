"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useCompany, api } from "@/components/company-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { NoCompanySelected } from "@/components/empty-state";
import { VoucherForm } from "@/components/voucher-form";
import { formatDate, formatINR, localDate, EXPENSE_HEADS } from "@/lib/utils";

/** Simple expense manager: add, list and total expenses by month and head. Each one is also a Rojmel Credit (money out) entry. */
export default function ExpensesPage() {
  const { active } = useCompany();
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try { setRows(await api(`/api/expenses?month=${month}`)); }
    catch (e) { setError(e.message); }
  }, [month]);

  useEffect(() => { if (active?.id) load(); }, [active?.id, load]);

  const byHead = useMemo(() => {
    const m = new Map();
    for (const r of rows) m.set(r.head, (m.get(r.head) || 0) + r.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const heads = useMemo(() => [...new Set([...EXPENSE_HEADS, ...rows.map((r) => r.head)])], [rows]);

  async function remove(r) {
    if (!confirm(`Delete expense "${r.head}" of ${formatINR(r.amount)}?`)) return;
    try { await api(`/api/vouchers/${r.refId}`, { method: "DELETE" }); load(); }
    catch (e) { alert(e.message); }
  }

  if (!active) return <NoCompanySelected />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Expenses</h1>
          <p className="text-sm text-muted-foreground">Day-to-day spending. Every expense also shows in Rojmel as Credit (money out).</p>
        </div>
        <label className="text-xs">Month<Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Add expense</CardTitle></CardHeader>
        <CardContent>
          <VoucherForm direction="OUT" heads={heads} compact onSaved={(v) => { if (v.date.startsWith(month)) load(); }} />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table>
            <THead>
              <TR>
                <TH className="w-28">Date</TH>
                <TH>Head</TH>
                <TH>Note</TH>
                <TH className="w-28">Mode</TH>
                <TH className="w-32 text-right">Amount</TH>
                <TH className="w-10"><span className="sr-only">Actions</span></TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap">{formatDate(r.date)}</TD>
                  <TD className="font-medium">{r.head}</TD>
                  <TD className="text-muted-foreground">{r.description !== r.head ? r.description : ""}</TD>
                  <TD>{r.mode || "—"}</TD>
                  <TD className="text-right">{formatINR(r.amount)}</TD>
                  <TD>
                    {r.deletable && (
                      <button onClick={() => remove(r)} className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${r.head}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </TD>
                </TR>
              ))}
              {rows.length === 0 && <TR><TD colSpan={6} className="py-6 text-center text-muted-foreground">No expenses this month.</TD></TR>}
            </TBody>
          </Table>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">By head</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {byHead.map(([head, amt]) => (
              <div key={head} className="flex justify-between"><span>{head}</span><span>{formatINR(amt)}</span></div>
            ))}
            <div className="flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>{formatINR(total)}</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
