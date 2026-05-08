"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, Upload, FileCheck, Loader2, X, RefreshCw, Plus, Trash2,
  CheckCircle2, AlertCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";
import { computeInvoice, gstStateFromGstin, GST_SLABS } from "@/lib/gst";
import { formatINR } from "@/lib/utils";
import { NoCompanySelected } from "@/components/empty-state";

const blankItem = () => ({
  name: "", sku: "", hsnCode: "", quantity: 1, unit: "PCS",
  purchasePrice: 0, gstRate: 18, discount: 0
});

export default function AiUploadPage() {
  const router = useRouter();
  const toast = useToast();
  const { active } = useCompany();

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [savingDraft, setSavingDraft] = useState(false);
  const [savingFinal, setSavingFinal] = useState(false);

  // Generate / revoke object URL when file changes
  useEffect(() => {
    if (!file) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!active) return <NoCompanySelected />;

  function calcConfidence(data) {
    let score = 0;
    if (data.supplierName) score += 25;
    if (data.billNumber) score += 15;
    if (data.billDate) score += 10;
    if (data.supplierGst) score += 10;
    if (data.items?.length) score += 20;
    const itemFields = ["name", "quantity", "purchasePrice", "gstRate"];
    if (data.items?.length) {
      const filled = data.items.reduce((acc, it) => acc + itemFields.filter((f) => it[f] !== undefined && it[f] !== "" && it[f] !== 0).length, 0);
      const max = data.items.length * itemFields.length;
      score += Math.round((filled / max) * 20);
    }
    return Math.min(100, score);
  }

  async function parsePdf() {
    if (!file) return;
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ai/parse-pdf", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const normalized = {
        supplierName: json.data.supplierName || "",
        supplierGst: json.data.supplierGst || "",
        billNumber: json.data.billNumber || "",
        billDate: json.data.billDate || new Date().toISOString().slice(0, 10),
        items: (json.data.items || []).map((it) => ({
          name: it.name || "",
          sku: "",
          hsnCode: it.hsnCode || "",
          quantity: Number(it.quantity) || 1,
          unit: it.unit || "PCS",
          purchasePrice: Number(it.purchasePrice) || 0,
          gstRate: Number(it.gstRate) || 18,
          discount: Number(it.discount) || 0
        })),
        notes: ""
      };
      setParsed(normalized);
      setConfidence(calcConfidence(normalized));
    } catch (e) {
      toast({ type: "error", title: "Parsing failed", message: e.message });
    } finally { setParsing(false); }
  }

  // Compute totals live as the user edits
  const computed = useMemo(() => {
    if (!parsed) return null;
    return computeInvoice({
      items: (parsed.items || []).map((i) => ({ ...i, sellingPrice: Number(i.purchasePrice) || 0 })),
      supplierStateCode: gstStateFromGstin(parsed.supplierGst),
      recipientStateCode: active?.stateCode || gstStateFromGstin(active?.gstNumber)
    });
  }, [parsed, active?.stateCode, active?.gstNumber]);

  function setItem(i, patch) {
    setParsed((p) => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) }));
  }
  function addItem() { setParsed((p) => ({ ...p, items: [...p.items, blankItem()] })); }
  function removeItem(i) { setParsed((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) })); }

  async function uploadOriginal() {
    if (!file) return "";
    const fd = new FormData();
    fd.append("file", file);
    fd.append("subfolder", "purchases");
    const u = await fetch("/api/upload", { method: "POST", body: fd });
    const uj = await u.json();
    return uj.ok ? uj.data.viewUrl : "";
  }

  async function save({ asDraft }) {
    asDraft ? setSavingDraft(true) : setSavingFinal(true);
    try {
      const pdfUrl = await uploadOriginal();
      await api("/api/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplierName: parsed.supplierName,
          supplierGst: parsed.supplierGst,
          billNumber: parsed.billNumber,
          billDate: parsed.billDate,
          items: parsed.items,
          amountPaid: 0,
          notes: parsed.notes || "",
          status: asDraft ? "Pending" : "Unpaid",
          autoCreateInventory: !asDraft,
          pdfUrl
        })
      });
      toast({ type: "success", title: asDraft ? "Saved as draft" : "Approved & inventory updated" });
      router.replace("/purchase");
    } catch (e) {
      toast({ type: "error", title: "Save failed", message: e.message });
    } finally {
      setSavingDraft(false); setSavingFinal(false);
    }
  }

  function reset() { setParsed(null); setFile(null); setConfidence(0); }

  // ──────────────── Initial upload screen ────────────────
  if (!parsed) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" /> AI Purchase Reader
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload a supplier's PDF invoice — AI extracts items, GST and totals so you can review and approve.
          </p>
        </div>

        <Card className="max-w-2xl">
          <CardContent className="p-6 space-y-4">
            <label className="block border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-accent transition-colors">
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <div className="mt-3 font-medium">{file ? file.name : "Click to choose a PDF"}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {file ? `${Math.round(file.size / 1024)} KB` : "Text-based PDFs up to 10 MB"}
              </div>
            </label>
            <Button disabled={!file || parsing} onClick={parsePdf} className="w-full">
              {parsing
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Parsing with Gemini…</>
                : <><Sparkles className="h-4 w-4" /> Extract with AI</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ──────────────── Review screen — PDF preview + extracted data ────────────────
  const interstate = computed?.interstate;
  const totalTax = (computed?.cgst || 0) + (computed?.sgst || 0) + (computed?.igst || 0);
  const high = confidence >= 85;
  const med = confidence >= 60;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" /> AI Purchase Reader
        </h1>
        <Button variant="outline" size="sm" onClick={reset}>
          <X className="h-3.5 w-3.5" /> Upload another
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ───── LEFT: PDF preview ───── */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Purchase PDF Analysis</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Uploaded vendor invoice. AI extracted line items and tax details on the right.
            </p>
          </div>
          <div className="p-4 bg-slate-100 dark:bg-slate-900 flex items-center gap-2 text-xs">
            <FileCheck className="h-4 w-4 text-emerald-600" />
            <span className="truncate flex-1">{file?.name}</span>
            <span className="text-muted-foreground">{Math.round((file?.size || 0) / 1024)} KB</span>
          </div>
          <div className="bg-slate-200 dark:bg-slate-800" style={{ height: 720 }}>
            {previewUrl ? (
              <iframe src={previewUrl} className="w-full h-full" title="PDF preview" />
            ) : (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">No preview available</div>
            )}
          </div>
        </Card>

        {/* ───── RIGHT: extracted data, editable ───── */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold">AI Extraction Result</h2>
              <div className={`mt-1 text-xs flex items-center gap-1.5 ${high ? "text-emerald-600" : med ? "text-amber-600" : "text-rose-600"}`}>
                {high ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                {high ? "High" : med ? "Medium" : "Low"} Confidence Match {confidence}%
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={parsePdf} title="Re-extract">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="p-4 space-y-4 max-h-[720px] overflow-auto">
            {/* Top fields */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="VENDOR NAME">
                <Input value={parsed.supplierName} onChange={(e) => setParsed({ ...parsed, supplierName: e.target.value })} />
              </Field>
              <Field label="INVOICE DATE">
                <Input type="date" value={parsed.billDate} onChange={(e) => setParsed({ ...parsed, billDate: e.target.value })} />
              </Field>
              <Field label="VENDOR GSTIN">
                <Input value={parsed.supplierGst} onChange={(e) => setParsed({ ...parsed, supplierGst: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="BILL NUMBER">
                <Input value={parsed.billNumber} onChange={(e) => setParsed({ ...parsed, billNumber: e.target.value })} />
              </Field>
            </div>

            {/* Items list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                  EXTRACTED ITEMS ({parsed.items.length})
                </div>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>

              <div className="space-y-2">
                {parsed.items.map((it, i) => (
                  <ItemCard
                    key={i}
                    item={it}
                    computed={computed?.items[i]}
                    onChange={(patch) => setItem(i, patch)}
                    onRemove={() => removeItem(i)}
                  />
                ))}
                {parsed.items.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center p-6 border border-dashed rounded">
                    No items extracted. Add manually using the button above.
                  </div>
                )}
              </div>
            </div>

            {/* Totals */}
            <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
              <Row label="Subtotal" value={formatINR(computed?.subtotal || 0)} />
              {interstate
                ? <Row label="IGST" value={formatINR(computed?.igst || 0)} />
                : (<><Row label="CGST" value={formatINR(computed?.cgst || 0)} /><Row label="SGST" value={formatINR(computed?.sgst || 0)} /></>)}
              <Row label="Total Tax (GST)" value={formatINR(totalTax)} />
              <div className="border-t pt-2 mt-2 flex items-baseline justify-between">
                <span className="font-semibold">Total Amount</span>
                <span className="text-2xl font-bold">{formatINR(computed?.grandTotal || 0)}</span>
              </div>
            </div>

            <Field label="Notes">
              <Textarea rows={2} value={parsed.notes || ""} onChange={(e) => setParsed({ ...parsed, notes: e.target.value })} />
            </Field>
          </div>

          {/* Action bar */}
          <div className="border-t p-3 flex justify-end gap-2 bg-background">
            <Button variant="outline" onClick={() => save({ asDraft: true })} disabled={savingDraft || savingFinal}>
              {savingDraft ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save Draft"}
            </Button>
            <Button onClick={() => save({ asDraft: false })} disabled={savingDraft || savingFinal || !parsed.supplierName || parsed.items.length === 0}>
              {savingFinal ? <><Loader2 className="h-4 w-4 animate-spin" /> Approving…</> : "Approve & Add to Inventory"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ItemCard({ item, computed, onChange, onRemove }) {
  return (
    <div className="rounded-md border p-3 space-y-2 bg-background">
      <div className="flex items-start gap-2">
        <Input
          className="font-medium flex-1"
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Product name"
        />
        <Button variant="ghost" size="icon" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <LabeledMini label="SKU">
          <Input value={item.sku} onChange={(e) => onChange({ sku: e.target.value })} />
        </LabeledMini>
        <LabeledMini label="HSN">
          <Input value={item.hsnCode} onChange={(e) => onChange({ hsnCode: e.target.value })} />
        </LabeledMini>
        <LabeledMini label="Qty">
          <Input type="number" min={0} step="0.01" value={item.quantity} onChange={(e) => onChange({ quantity: Number(e.target.value) })} />
        </LabeledMini>
        <LabeledMini label="Unit">
          <Input value={item.unit} onChange={(e) => onChange({ unit: e.target.value })} />
        </LabeledMini>
        <LabeledMini label="Rate">
          <Input type="number" min={0} step="0.01" value={item.purchasePrice} onChange={(e) => onChange({ purchasePrice: Number(e.target.value) })} />
        </LabeledMini>
        <LabeledMini label="GST%">
          <Select value={item.gstRate} onChange={(e) => onChange({ gstRate: Number(e.target.value) })}>
            {GST_SLABS.map((r) => <option key={r} value={r}>{r}%</option>)}
          </Select>
        </LabeledMini>
        <LabeledMini label="Disc">
          <Input type="number" min={0} step="0.01" value={item.discount} onChange={(e) => onChange({ discount: Number(e.target.value) })} />
        </LabeledMini>
        <div className="text-right pt-5 text-sm font-semibold">{formatINR(computed?.total || 0)}</div>
      </div>
    </div>
  );
}

function LabeledMini({ label, children }) {
  return (
    <label className="block">
      <span className="text-[10px] text-muted-foreground tracking-wide">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
