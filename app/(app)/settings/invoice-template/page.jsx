"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, useCompany } from "@/components/company-context";
import { NoCompanySelected } from "@/components/empty-state";
import { generateInvoicePdf } from "@/lib/pdf";
import { computeInvoice } from "@/lib/gst";
import { DEFAULT_TEMPLATE, TEMPLATE_SECTIONS } from "@/lib/invoice-template";
import { uploadLogo } from "@/components/logo-upload";
import { nextInvoiceNumber, localDate } from "@/lib/utils";

const SAMPLE_CUSTOMER = {
  name: "Shree Ganesh Constructions", address: "Plot 12, GIDC Estate, Vapi, Gujarat 396195",
  gstNumber: "24ABCDE1234F1Z5", stateCode: "24", state: "Gujarat", phone: "98250 00000"
};
const SAMPLE_META = {
  challanNumber: "DC-118", challanDate: "2026-10-28", orderNumber: "PO/4471", orderDate: "2026-10-20",
  transporter: "VRL Logistics", lrNumber: "LR 55102", lrDate: "2026-10-29", ewayNumber: "3410 2219 8890",
  paymentTerms: "30 days", consigneeSameAsBuyer: true
};

const SAMPLE_ITEMS = [
  { name: "6SQ MM PVC INS.HV INDL. CABLE 1100V", hsnCode: "85446090", quantity: 2, unit: "BDL", sellingPrice: 7047.55, gstRate: 18, discount: 0 },
  { name: "MINIATURE CIRCUIT BREAKER 63-3", hsnCode: "85362030", quantity: 44, unit: "NOS", sellingPrice: 1232.64, gstRate: 18, discount: 0 },
  { name: "PVC ROUND CONDUIT 25 MM", hsnCode: "39172390", quantity: 150, unit: "MTR", sellingPrice: 38.5, gstRate: 18, discount: 288.75 }
];

/** Sample bill for the preview; `long` repeats lines so the page-2 flow can be checked. */
function sampleInvoice(company, long) {
  const items = long ? Array.from({ length: 42 }, (_, i) => ({ ...SAMPLE_ITEMS[i % 3], name: `${SAMPLE_ITEMS[i % 3].name} (${i + 1})` })) : SAMPLE_ITEMS;
  const c = computeInvoice({
    items,
    supplierStateCode: company.stateCode || "24", recipientStateCode: "24", invoiceDiscount: 500, roundToRupee: true
  });
  return {
    invoiceNumber: "INV/26-27/0042", invoiceDate: "2026-10-30", dueDate: "2026-11-29", items: c.items,
    subtotal: c.subtotal, cgst: c.cgst, sgst: c.sgst, igst: c.igst, invoiceDiscount: c.invoiceDiscount,
    grandTotal: c.grandTotal, metadata: SAMPLE_META
  };
}

/** PNG/JPEG company logo as a data URL for the preview. */
async function loadLogo(url) {
  const format = /\.png$/i.test(url || "") ? "PNG" : /\.jpe?g$/i.test(url || "") ? "JPEG" : null;
  if (!format) return null;
  try {
    const blob = await (await fetch(url)).blob();
    const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
    return { dataUrl, format };
  } catch { return null; }
}

/** Settings → Invoice template: toggle and rename invoice sections with a live A4 preview. */
export default function InvoiceTemplatePage() {
  const { active, refresh } = useCompany();
  const toast = useToast();
  const [tpl, setTpl] = useState(null);
  const [custom, setCustom] = useState(false);
  const [logo, setLogo] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [terms, setTerms] = useState("");
  const [long, setLong] = useState(false);

  useEffect(() => {
    if (!active?.id) return;
    api("/api/settings/invoice-template").then((r) => { setTpl(r.template); setCustom(r.custom); }).catch((e) => toast({ type: "error", title: e.message }));
    loadLogo(active.logoUrl).then(setLogo);
  }, [active?.id, active?.logoUrl]);

  useEffect(() => { setTerms(active?.termsAndConditions || ""); }, [active?.id, active?.termsAndConditions]);

  const invoice = useMemo(() => (active ? sampleInvoice(active, long) : null), [active, long]);
  // Preview prints the terms being edited; bank, address and logo come from the company record.
  const company = useMemo(() => (active ? { ...active, termsAndConditions: terms } : null), [active, terms]);

  // Re-render the preview shortly after the last change.
  useEffect(() => {
    if (!tpl || !active) return;
    let url = "";
    const t = setTimeout(() => {
      const blob = generateInvoicePdf({ company, customer: SAMPLE_CUSTOMER, template: tpl, logo, output: "blob",
        invoice: { ...invoice, invoiceNumber: nextInvoiceNumber([], "INV", tpl.text.numberFormat, invoice.invoiceDate) } });
      url = URL.createObjectURL(blob);
      setPreview(url);
    }, 300);
    return () => { clearTimeout(t); if (url) URL.revokeObjectURL(url); };
  }, [tpl, logo, company, invoice]);

  if (!active) return <NoCompanySelected />;
  if (!tpl) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const setShow = (k, v) => setTpl({ ...tpl, show: { ...tpl.show, [k]: v } });
  const setLabel = (k, v) => setTpl({ ...tpl, labels: { ...tpl.labels, [k]: v } });
  const setText = (k, v) => setTpl({ ...tpl, text: { ...tpl.text, [k]: v } });

  async function save(e) {
    e?.preventDefault();
    setBusy(true);
    try {
      const r = await api("/api/settings/invoice-template", { method: "PUT", body: JSON.stringify({ template: tpl }) });
      setTpl(r.template); setCustom(true);
      if (terms.trim() !== (active.termsAndConditions || "").trim()) {
        await api(`/api/companies/${active.id}`, { method: "PUT", body: JSON.stringify({ termsAndConditions: terms.trim() }) });
        await refresh();
      }
      toast({ type: "success", title: "Invoice template saved" });
    } catch (err) { toast({ type: "error", title: "Could not save", message: err.message }); }
    finally { setBusy(false); }
  }

  async function reset() {
    if (!confirm("Reset the invoice template to the default layout?")) return;
    setBusy(true);
    try {
      const r = await api("/api/settings/invoice-template", { method: "DELETE" });
      setTpl(r.template); setCustom(false);
    } catch (err) { toast({ type: "error", title: err.message }); }
    finally { setBusy(false); }
  }

  async function changeLogo(file) {
    if (!file) return;
    setBusy(true);
    try {
      const logoUrl = await uploadLogo(file);
      await api(`/api/companies/${active.id}`, { method: "PUT", body: JSON.stringify({ logoUrl }) });
      await refresh();
      toast({ type: "success", title: "Logo updated" });
    } catch (err) { toast({ type: "error", title: "Logo not saved", message: err.message }); }
    finally { setBusy(false); }
  }

  const bank = [active.bankName, active.bankBranch && `Br. ${active.bankBranch}`, active.bankAccountNo && `A/c ${active.bankAccountNo}`, active.bankIfsc && `IFSC ${active.bankIfsc}`].filter(Boolean).join(" · ");

  const extraText = {
    Header: (
      <>
        <label className="block text-xs space-y-1">
          <span>Logo (any image; saved to the company, printed top-left)</span>
          <Input type="file" accept="image/*" className="h-8 text-xs" disabled={busy} onChange={(e) => { changeLogo(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <label className="block text-xs space-y-1">
          <span>Tagline lines under the name (one per line, e.g. &quot;Auth.Dist.: POLYCAB MAKE PVC CONDUITS&quot;)</span>
          <Textarea rows={2} maxLength={300} value={tpl.text.tagline} onChange={(e) => setText("tagline", e.target.value)} />
        </label>
      </>
    ),
    "Title bar": (
      <label className="flex items-center gap-2 text-xs">Reverse charge applies
        <Select className="h-8 w-24" value={tpl.text.reverseCharge} onChange={(e) => setText("reverseCharge", e.target.value)}>
          <option>No</option><option>Yes</option>
        </Select>
      </label>
    ),
    Footer: (
      <>
        <label className="block text-xs space-y-1"><span>Declaration text</span>
          <Textarea rows={2} maxLength={600} value={tpl.text.declaration} onChange={(e) => setText("declaration", e.target.value)} />
        </label>
        <label className="block text-xs space-y-1"><span>Terms &amp; conditions, one per line (numbered automatically). Same as Settings → Terms &amp; Conditions.</span>
          <Textarea rows={4} maxLength={1500} value={terms} onChange={(e) => setTerms(e.target.value)} />
        </label>
        <p className="text-xs text-muted-foreground">
          Bank printed: {bank || <b className="text-destructive">none set</b>}.{" "}
          <Link className="underline" href="/settings/company">Edit bank details</Link>
        </p>
      </>
    )
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl font-semibold">Invoice template</h1>
            <p className="text-xs text-muted-foreground">{custom ? "Custom layout for " : "Default layout for "}{active.name}. Applies to every invoice PDF of this company.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy || !custom} onClick={reset}>Reset to default</Button>
          <Button data-accept disabled={busy} onClick={save}>{busy ? "Saving…" : "Save template"}</Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(300px,400px)_1fr]">
        <form onSubmit={save} className="space-y-3 lg:max-h-[calc(100vh-170px)] lg:overflow-auto pr-1">
          <Card>
            <CardHeader className="py-2"><CardTitle className="text-sm">Invoice number format</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 pb-3 text-xs">
              <Input className="h-8 font-mono text-xs" aria-label="Invoice number format" maxLength={60} value={tpl.text.numberFormat}
                placeholder={DEFAULT_TEMPLATE.text.numberFormat} onChange={(e) => setText("numberFormat", e.target.value)} />
              <p>Next tax invoice: <b className="font-mono">{nextInvoiceNumber([], "INV", tpl.text.numberFormat || DEFAULT_TEMPLATE.text.numberFormat, localDate())}</b></p>
              <p className="text-muted-foreground">
                {"{PREFIX}"} = INV / PI / PO / DC / QT · {"{YYYY}"} {"{YY}"} {"{MM}"} {"{DD}"} = date · {"{FY}"} = financial year (26-27) ·
                {" {####}"} = running number, one # per digit. The number restarts at 1 when the rest changes (e.g. each month with {"{MM}"}, each year with {"{FY}"}).
                Example: <span className="font-mono">{"{PREFIX}/{FY}/{###}"}</span> → INV/26-27/001.
              </p>
            </CardContent>
          </Card>
          {TEMPLATE_SECTIONS.map((sec) => (
            <Card key={sec.title}>
              <CardHeader className="py-2"><CardTitle className="text-sm">{sec.title}</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 pb-3">
                {sec.rows.map((r) => (
                  <div key={r.show || r.label} className="grid grid-cols-[1.25rem_7.5rem_1fr] items-center gap-2 text-xs">
                    {r.show
                      ? <input type="checkbox" aria-label={`Show ${r.name}`} checked={tpl.show[r.show]} onChange={(e) => setShow(r.show, e.target.checked)} />
                      : <span />}
                    <span className={r.show && !tpl.show[r.show] ? "text-muted-foreground line-through" : ""}>{r.name}</span>
                    {r.label
                      ? <Input className="h-7 text-xs" aria-label={`${r.name} label`} maxLength={160} value={tpl.labels[r.label]}
                          placeholder={DEFAULT_TEMPLATE.labels[r.label]} onChange={(e) => setLabel(r.label, e.target.value)} />
                      : <span />}
                  </div>
                ))}
                {extraText[sec.title]}
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground">Logo, bank details and address come from <Link className="underline" href="/settings/company">company settings</Link>.</p>
        </form>

        <div className="rounded-md border bg-muted/40 min-h-[480px] h-[calc(100vh-170px)] flex flex-col">
          <label className="flex items-center gap-2 border-b px-3 py-1.5 text-xs">
            <input type="checkbox" checked={long} onChange={(e) => setLong(e.target.checked)} />
            Preview a long bill (checks how it continues on page 2)
          </label>
          {preview
            ? <iframe title="Invoice preview" src={`${preview}#toolbar=0&view=FitH`} className="flex-1 w-full rounded-b-md" />
            : <p className="p-4 text-sm text-muted-foreground">Rendering preview…</p>}
        </div>
      </div>
    </div>
  );
}
