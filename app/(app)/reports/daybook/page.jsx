"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Trash2 } from "lucide-react";
import { useCompany, api } from "@/components/company-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { NoCompanySelected } from "@/components/empty-state";
import { ReportsNav } from "@/components/reports-nav";
import { VoucherForm } from "@/components/voucher-form";
import { formatDate, formatINR, localDate, EXPENSE_HEADS } from "@/lib/utils";

function Stat({ label, value, className = "" }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-lg font-semibold ${className}`}>{formatINR(value)}</div>
      </CardContent>
    </Card>
  );
}

/** Rojmel: the cash book. Debit = money in, Credit = money out, with running balance. */
export default function RojmelPage() {
  const { active } = useCompany();
  const [range, setRange] = useState(() => ({ from: `${localDate().slice(0, 7)}-01`, to: localDate() }));
  const [book, setBook] = useState(null);
  const [error, setError] = useState("");
  const [entry, setEntry] = useState(null); // "IN" | "OUT" | "CONTRA" | null
  const router = useRouter();
  const q = useSearchParams();

  // F4 / F5 / F6 land here with ?entry=CONTRA|OUT|IN: open that form, then drop the param.
  useEffect(() => {
    const want = q.get("entry");
    if (!["IN", "OUT", "CONTRA"].includes(want)) return;
    setEntry(want);
    router.replace("/reports/daybook");
  }, [q, router]);

  const load = useCallback(async () => {
    setError("");
    try { setBook(await api(`/api/reports/daybook?from=${range.from}&to=${range.to}`)); }
    catch (e) { setError(e.message); }
  }, [range]);

  useEffect(() => { if (active?.id) load(); }, [active?.id, load]);

  async function remove(row) {
    if (!confirm(`Delete this entry of ${formatINR(row.jama || row.udhar)}?`)) return;
    try { await api(`/api/vouchers/${row.refId}`, { method: "DELETE" }); load(); }
    catch (e) { alert(e.message); }
  }

  async function syncOld() {
    try {
      const res = await api("/api/reports/daybook/sync", { method: "POST" });
      alert(res.synced.length ? `Added ${res.synced.length} missing entries.` : "Nothing missing. Books are up to date.");
      load();
    } catch (e) { alert(e.message); }
  }

  if (!active) return <NoCompanySelected />;

  return (
    <div className="space-y-4">
      <ReportsNav />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Rojmel (Cash Book)</h1>
          <p className="text-sm text-muted-foreground">Every rupee in and out by cash, UPI, bank and cheque. Invoice receipts and bill payments appear here automatically.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">From<Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
          <label className="text-xs">To<Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
          <Button className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => setEntry("IN")}><ArrowDownLeft className="h-4 w-4" />Receipt (In) · F6</Button>
          <Button className="gap-1 bg-rose-600 hover:bg-rose-700" onClick={() => setEntry("OUT")}><ArrowUpRight className="h-4 w-4" />Payment (Out) · F5</Button>
          <Button variant="outline" className="gap-1" onClick={() => setEntry("CONTRA")}><ArrowLeftRight className="h-4 w-4" />Contra · F4</Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {book && (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Stat label="Opening balance" value={book.opening} />
            <Stat label="Debit (in)" value={book.totalJama} className="text-emerald-700" />
            <Stat label="Credit (out)" value={book.totalUdhar} className="text-rose-700" />
            <Stat label="Closing balance" value={book.closing} className={book.closing < 0 ? "text-destructive" : ""} />
          </div>

          <Table>
            <THead>
              <TR>
                <TH className="w-28">Date</TH>
                <TH>Particulars</TH>
                <TH className="w-28">Mode</TH>
                <TH className="w-32 text-right">Debit</TH>
                <TH className="w-32 text-right">Credit</TH>
                <TH className="w-32 text-right">Balance</TH>
                <TH className="w-10"><span className="sr-only">Actions</span></TH>
              </TR>
            </THead>
            <TBody>
              <TR className="bg-muted/40 font-medium">
                <TD>{formatDate(book.from)}</TD>
                <TD colSpan={4}>Opening balance</TD>
                <TD className="text-right">{formatINR(book.opening)}</TD>
                <TD />
              </TR>
              {book.rows.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap">{formatDate(r.date)}</TD>
                  <TD>
                    <div className="font-medium">{r.particulars}</div>
                    {r.description && r.description !== r.particulars && <div className="text-xs text-muted-foreground">{r.description}</div>}
                  </TD>
                  <TD>{r.mode}</TD>
                  <TD className="text-right text-emerald-700">{r.jama ? formatINR(r.jama) : ""}</TD>
                  <TD className="text-right text-rose-700">{r.udhar ? formatINR(r.udhar) : ""}</TD>
                  <TD className="text-right font-medium">{formatINR(r.balance)}</TD>
                  <TD>
                    {r.deletable && (
                      <button onClick={() => remove(r)} className="text-muted-foreground hover:text-destructive" aria-label="Delete entry">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </TD>
                </TR>
              ))}
              {book.rows.length === 0 && (
                <TR><TD colSpan={7} className="py-6 text-center text-muted-foreground">No cash movement in this period.</TD></TR>
              )}
              <TR className="bg-muted/40 font-semibold">
                <TD colSpan={3}>Closing balance ({formatDate(book.to)})</TD>
                <TD className="text-right">{formatINR(book.totalJama)}</TD>
                <TD className="text-right">{formatINR(book.totalUdhar)}</TD>
                <TD className="text-right">{formatINR(book.closing)}</TD>
                <TD />
              </TR>
            </TBody>
          </Table>

          <p className="text-xs text-muted-foreground">
            Entries from older versions missing here?{" "}
            <button className="underline" onClick={syncOld}>Add missing invoice and payment entries</button>
          </p>
        </>
      )}

      <Dialog open={Boolean(entry)} onClose={() => setEntry(null)} title={entry === "IN" ? "Receipt (Debit): money received" : entry === "CONTRA" ? "Contra: move money between cash and bank" : "Payment (Credit): money paid out"}>
        {entry && (
          <VoucherForm
            direction={entry}
            heads={entry === "OUT" ? EXPENSE_HEADS : ["Owner capital", "Loan received", "Other income"]}
            onCancel={() => setEntry(null)}
            onSaved={() => { setEntry(null); load(); }}
          />
        )}
      </Dialog>
    </div>
  );
}
