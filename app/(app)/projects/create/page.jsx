"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { BoqEditor, boqSubtotal } from "@/components/boq-editor";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";
import { formatINR } from "@/lib/utils";
import { NoCompanySelected } from "@/components/empty-state";

export default function CreateProjectPage() {
  const router = useRouter();
  const toast = useToast();
  const { active } = useCompany();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    name: "", code: "", customerId: "", description: "",
    boqItems: [], contractValue: "",
    startDate: new Date().toISOString().slice(0, 10), endDate: "",
    status: "Active", notes: ""
  });
  const [overridden, setOverridden] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (active?.id) api("/api/customers").then(setCustomers).catch(() => setCustomers([]));
  }, [active?.id]);

  if (!active) return <NoCompanySelected />;

  const subtotal = boqSubtotal(form.boqItems);
  const taxValue = (form.boqItems || []).reduce((s, r) =>
    s + ((Number(r.quantity) || 0) * (Number(r.rate) || 0) * (Number(r.gstRate) || 0)) / 100
  , 0);
  const computedContract = subtotal + taxValue;
  const effectiveContract = overridden && form.contractValue !== "" ? Number(form.contractValue) : computedContract;

  function set(k, v) { setForm((s) => ({ ...s, [k]: v })); }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.customerId) {
      toast({ type: "error", title: "Project name and customer are required" });
      return;
    }
    setSaving(true);
    try {
      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          contractValue: effectiveContract
        })
      });
      toast({ type: "success", title: "Project created" });
      router.replace("/projects");
    } catch (e) {
      toast({ type: "error", title: "Could not save", message: e.message });
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New Project</h1>

      <Card>
        <CardHeader>
          <CardTitle>Basic info</CardTitle>
          <CardDescription>Each project has one customer and a fixed contract value derived from its BOQ.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            <Field label="Project name *">
              <Input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. ABC Hotel — Renovation" />
            </Field>
            <Field label="Project code">
              <Input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="e.g. ABC-2026-001" />
            </Field>
            <Field label="Customer *">
              <Select required value={form.customerId} onChange={(e) => set("customerId", e.target.value)}>
                <option value="">Select customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.gstNumber ? ` · ${c.gstNumber}` : ""}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option>Active</option>
                <option>On Hold</option>
                <option>Completed</option>
                <option>Cancelled</option>
              </Select>
            </Field>
            <Field label="Start date">
              <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </Field>
            <Field label="End date">
              <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Description">
                <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create project"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bill of Quantities</CardTitle>
          <CardDescription>List the scope items for this project. Subtotal × GST gives the auto contract value.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BoqEditor value={form.boqItems} onChange={(v) => set("boqItems", v)} />

          <div className="grid gap-3 md:grid-cols-3 pt-3 border-t">
            <div className="rounded-md border p-3">
              <div className="text-[11px] text-muted-foreground uppercase">Subtotal (pre-tax)</div>
              <div className="text-lg font-semibold">{formatINR(subtotal)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-[11px] text-muted-foreground uppercase">Estimated tax</div>
              <div className="text-lg font-semibold">{formatINR(taxValue)}</div>
            </div>
            <div className="rounded-md border p-3 bg-muted/40">
              <div className="text-[11px] text-muted-foreground uppercase">Contract value</div>
              <div className="flex items-center gap-2">
                {overridden ? (
                  <Input
                    type="number"
                    className="font-semibold text-lg h-10"
                    value={form.contractValue}
                    onChange={(e) => set("contractValue", e.target.value)}
                  />
                ) : (
                  <div className="text-lg font-semibold">{formatINR(computedContract)}</div>
                )}
                <Button size="sm" variant="ghost" type="button" onClick={() => {
                  if (!overridden) set("contractValue", computedContract);
                  setOverridden((v) => !v);
                }}>
                  {overridden ? "Auto" : "Override"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
