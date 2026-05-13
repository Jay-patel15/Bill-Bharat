"use client";
import { useEffect, useState } from "react";
import { useCompany, api } from "@/components/company-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function JournalsPage() {
  const { active } = useCompany();
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    entries: [
      { ledgerName: "", debit: "", credit: "" },
      { ledgerName: "", debit: "", credit: "" }
    ]
  });

  useEffect(() => {
    if (active) loadJournals();
  }, [active]);

  async function loadJournals() {
    try {
      setLoading(true);
      const data = await api("/api/journals");
      setJournals(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function addEntry() {
    setForm({ ...form, entries: [...form.entries, { ledgerName: "", debit: "", credit: "" }] });
  }

  function removeEntry(index) {
    if (form.entries.length <= 2) return;
    setForm({ ...form, entries: form.entries.filter((_, i) => i !== index) });
  }

  function updateEntry(index, field, value) {
    const next = [...form.entries];
    next[index][field] = value;
    setForm({ ...form, entries: next });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const debits = form.entries.reduce((s, e) => s + (Number(e.debit) || 0), 0);
    const credits = form.entries.reduce((s, e) => s + (Number(e.credit) || 0), 0);

    if (Math.abs(debits - credits) > 0.01) {
      alert(`Unbalanced Journal! Total Debits (${debits}) must equal Total Credits (${credits})`);
      return;
    }

    try {
      setLoading(true);
      await api("/api/journals", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setOpen(false);
      loadJournals();
      setForm({
        date: new Date().toISOString().slice(0, 10),
        description: "",
        entries: [{ ledgerName: "", debit: "", credit: "" }, { ledgerName: "", debit: "", credit: "" }]
      });
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!active) return <div className="p-10 text-center">Select a company to view journals.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manual Journal Vouchers</h1>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Journal
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Journal Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && journals.length === 0 ? (
            <div className="py-10 text-center">Loading journals...</div>
          ) : journals.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No manual journals found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium">Description</th>
                    <th className="p-3 font-medium">Entries</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {journals.map((j) => (
                    <tr key={j.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 whitespace-nowrap font-medium">{format(new Date(j.date), "dd MMM yyyy")}</td>
                      <td className="p-3">{j.description}</td>
                      <td className="p-3">
                        <div className="space-y-1">
                          {j.entries.map((e, idx) => (
                            <div key={idx} className="flex gap-4 text-xs">
                              <span className="w-32 truncate font-semibold">{e.ledgerName}</span>
                              <span className="w-16 text-right text-blue-600 font-bold">{e.debit > 0 ? `Dr ${e.debit}` : ""}</span>
                              <span className="w-16 text-right text-red-600 font-bold">{e.credit > 0 ? `Cr ${e.credit}` : ""}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title="Create Journal Entry" size="xl">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Date"><Input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Narration/Description"><Input placeholder="Reason for entry" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
          </div>

          <div className="space-y-2">
            <div className="flex gap-4 px-2 text-xs font-bold uppercase text-muted-foreground">
              <div className="flex-1">Ledger Name</div>
              <div className="w-32">Debit (Dr)</div>
              <div className="w-32">Credit (Cr)</div>
              <div className="w-10"></div>
            </div>
            {form.entries.map((entry, idx) => (
              <div key={idx} className="flex gap-4 items-start">
                <div className="flex-1">
                  <Input placeholder="Search ledger..." required value={entry.ledgerName} onChange={e => updateEntry(idx, 'ledgerName', e.target.value)} />
                </div>
                <div className="w-32">
                  <Input type="number" placeholder="0.00" value={entry.debit} onChange={e => updateEntry(idx, 'debit', e.target.value)} />
                </div>
                <div className="w-32">
                  <Input type="number" placeholder="0.00" value={entry.credit} onChange={e => updateEntry(idx, 'credit', e.target.value)} />
                </div>
                <button type="button" onClick={() => removeEntry(idx)} className="p-2 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <Button type="button" variant="outline" size="sm" onClick={addEntry}>+ Add Ledger Row</Button>
            <div className="flex gap-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Record Journal (F7)"}</Button>
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
