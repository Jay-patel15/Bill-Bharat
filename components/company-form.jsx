"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { STATES } from "@/lib/utils";

export function CompanyForm({ initial = {}, submitLabel = "Save", onSubmit }) {
  const [form, setForm] = useState({
    name: "", logoUrl: "", address: "", city: "", state: "", stateCode: "",
    pincode: "", gstNumber: "", panNumber: "", bankAccountNo: "", bankIfsc: "",
    bankName: "", bankBranch: "", termsAndConditions: "", phone: "", email: "",
    ...initial
  });
  const [submitting, setSubmitting] = useState(false);

  function set(k, v) { setForm((s) => ({ ...s, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try { await onSubmit(form); } finally { setSubmitting(false); }
  }

  async function handleLogo(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("subfolder", "logos");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();
    if (json.ok) set("logoUrl", json.data.viewUrl);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
      <Field label="Company name *">
        <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="GSTIN">
        <Input value={form.gstNumber} onChange={(e) => {
          set("gstNumber", e.target.value.toUpperCase());
          if (e.target.value.length >= 2) set("stateCode", e.target.value.substring(0, 2));
        }} placeholder="22AAAAA0000A1Z5" />
      </Field>

      <Field label="PAN">
        <Input value={form.panNumber} onChange={(e) => set("panNumber", e.target.value.toUpperCase())} />
      </Field>
      <Field label="Phone">
        <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="Logo">
        <div className="flex gap-3 items-center">
          <Input type="file" accept="image/*" onChange={(e) => handleLogo(e.target.files?.[0])} />
          {form.logoUrl ? <a href={form.logoUrl} className="text-xs text-primary underline" target="_blank" rel="noreferrer">View</a> : null}
        </div>
      </Field>

      <Field label="Address">
        <Textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="City">
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Pincode">
          <Input value={form.pincode} onChange={(e) => set("pincode", e.target.value)} />
        </Field>
        <Field label="State">
          <Select value={form.stateCode} onChange={(e) => {
            const code = e.target.value;
            const s = STATES.find(([c]) => c === code);
            set("stateCode", code);
            set("state", s ? s[1] : "");
          }}>
            <option value="">—</option>
            {STATES.map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Bank Name">
        <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
      </Field>
      <Field label="Bank Branch">
        <Input value={form.bankBranch} onChange={(e) => set("bankBranch", e.target.value)} />
      </Field>
      <Field label="Account Number">
        <Input value={form.bankAccountNo} onChange={(e) => set("bankAccountNo", e.target.value)} />
      </Field>
      <Field label="IFSC">
        <Input value={form.bankIfsc} onChange={(e) => set("bankIfsc", e.target.value.toUpperCase())} />
      </Field>
      <div />

      <div className="md:col-span-2">
        <Field label="Terms & Conditions">
          <Textarea rows={4} value={form.termsAndConditions} onChange={(e) => set("termsAndConditions", e.target.value)} />
        </Field>
      </div>

      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
