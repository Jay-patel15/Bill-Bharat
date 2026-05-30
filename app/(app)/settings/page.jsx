"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Settings, Loader2, Upload, FileImage, Palette, Type, Eye, Save, X, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, useCompany } from "@/components/company-context";
import { NoCompanySelected } from "@/components/empty-state";

const FONT_OPTIONS = [
  { label: "Inter (Modern)", value: "Inter, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Poppins", value: "Poppins, sans-serif" },
  { label: "Noto Sans", value: "'Noto Sans', sans-serif" },
  { label: "Times New Roman (Classic)", value: "'Times New Roman', serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Courier New (Typewriter)", value: "'Courier New', monospace" },
];

const FONT_WEIGHTS = [
  { label: "Thin", value: "300" },
  { label: "Normal", value: "400" },
  { label: "Medium", value: "500" },
  { label: "Semi Bold", value: "600" },
  { label: "Bold", value: "700" },
  { label: "Extra Bold", value: "800" },
];

function defaultWordStyle() {
  return { fontSize: "28", fontWeight: "700", color: "#111111", italic: false, fontFamily: "" };
}

export default function SettingsPage() {
  const router = useRouter();
  const [active, refresh] = [useCompany().active, useCompany().refresh];
  const [activeSection, setActiveSection] = useState(null); // null, 'template', or 'products'
  const [mappings, setMappings] = useState([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- Invoice Template state ---
  const [templateImg, setTemplateImg] = useState(null); // base64 preview of uploaded reference bill
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [globalFont, setGlobalFont] = useState("Inter, sans-serif");
  const [showPreview, setShowPreview] = useState(false);

  // Per-word name styling — splits company name into words
  const companyName = active?.name || "";
  const words = companyName.split(/\s+/).filter(Boolean);

  const [wordStyles, setWordStyles] = useState({});

  // Load saved template from company profile
  useEffect(() => {
    if (active?.invoiceTemplate) {
      try {
        const t = typeof active.invoiceTemplate === "string"
          ? JSON.parse(active.invoiceTemplate)
          : active.invoiceTemplate;
        if (t.globalFont) setGlobalFont(t.globalFont);
        if (t.wordStyles) setWordStyles(t.wordStyles);
        if (t.templateImg) setTemplateImg(t.templateImg);
      } catch {}
    }
  }, [active?.id]);

  useEffect(() => {
    if (active?.id) {
      setLoading(true);
      api("/api/product-mappings")
        .then(setMappings)
        .catch(() => setMappings([]))
        .finally(() => setLoading(false));
    }
  }, [active?.id]);

  if (!active) return <NoCompanySelected />;

  // --- Word style helpers ---
  function getWordStyle(word) {
    return wordStyles[word] || defaultWordStyle();
  }
  function setWordStyleField(word, field, value) {
    setWordStyles(prev => ({
      ...prev,
      [word]: { ...getWordStyle(word), [field]: value }
    }));
  }
  function resetWordStyle(word) {
    setWordStyles(prev => {
      const next = { ...prev };
      delete next[word];
      return next;
    });
  }

  // --- Reference bill upload ---
  function handleBillUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setTemplateImg(ev.target.result);
    reader.readAsDataURL(file);
  }

  // --- Save template settings ---
  async function saveTemplate() {
    setTemplateSaving(true);
    setTemplateSaved(false);
    try {
      const payload = {
        invoiceTemplate: JSON.stringify({
          globalFont,
          wordStyles,
          templateImg: templateImg || null,
        })
      };
      await api(`/api/companies/${active.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      await refresh();
      setTemplateSaved(true);
      setTimeout(() => setTemplateSaved(false), 2500);
    } catch (e) {
      alert(e.message || "Failed to save template");
    } finally {
      setTemplateSaving(false);
    }
  }

  // --- Product mappings ---
  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const added = await api("/api/product-mappings", {
        method: "POST",
        body: JSON.stringify({ realName: newName.trim() })
      });
      setMappings((prev) => [...prev, added]);
      setNewName("");
    } catch (err) {
      alert(err.message || "Failed to add mapping");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Remove this product name?")) return;
    try {
      await api(`/api/product-mappings/${id}`, { method: "DELETE" });
      setMappings((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      alert(err.message || "Failed to delete");
    }
  }

  // --- Live header preview ---
  function HeaderPreview() {
    return (
      <div className="rounded-lg border bg-white p-6 shadow-sm" style={{ fontFamily: globalFont }}>
        <div className="flex items-center gap-4 border-b pb-4 mb-3">
          {active?.logoUrl ? (
            <img src={active.logoUrl} alt="logo" className="h-14 w-14 object-contain rounded" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
              {companyName[0]}
            </div>
          )}
          <div>
            <div className="flex flex-wrap gap-1 items-baseline">
              {words.map((word) => {
                const ws = getWordStyle(word);
                return (
                  <span key={word} style={{ fontSize: `${ws.fontSize}px`, fontWeight: ws.fontWeight, color: ws.color, fontStyle: ws.italic ? "italic" : "normal", fontFamily: ws.fontFamily || globalFont }}>
                    {word}
                  </span>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-1">{active?.address || "Address, City, State"}</p>
            <p className="text-xs text-gray-500">{active?.gstNumber ? `GSTIN: ${active.gstNumber}` : ""} {active?.phone ? `| Ph: ${active.phone}` : ""}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 text-xs text-gray-500 gap-2">
          <div><span className="font-semibold text-gray-700">Invoice No:</span> INV-0001</div>
          <div><span className="font-semibold text-gray-700">Date:</span> 20/05/2026</div>
          <div><span className="font-semibold text-gray-700">Due:</span> 30/05/2026</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {activeSection === null ? (
        <>
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">Settings</h1>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Card 1: Invoice Template Designer */}
            <Card
              className="hover:border-primary/50 cursor-pointer transition-all hover:shadow-md border-2 border-transparent bg-card group"
              onClick={() => setActiveSection("template")}
            >
              <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                  <Palette className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">Invoice Template Designer</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Customize invoice colors, fonts, logo and layout styling.</p>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Upload template bill formats, set your favorite font styles, and configure per-word styling of your company name (like size, color, weight) to build the perfect bill.
                </p>
                <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                  Configure Template &rarr;
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Product Master Names */}
            <Card
              className="hover:border-primary/50 cursor-pointer transition-all hover:shadow-md border-2 border-transparent bg-card group"
              onClick={() => setActiveSection("products")}
            >
              <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">Product Master Names</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Define master mapping names to keep inventory clean.</p>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Prevent duplicates during invoice uploads. Link vendor item names to standard names (e.g. "Cement 50kg") and manage your product catalogue settings.
                </p>
                <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                  Manage Product Master &rarr;
                </div>
              </CardContent>
            </Card>

            {/* Card 3: AI Sales Invoice Generator */}
            <Card
              className="hover:border-primary/50 cursor-pointer transition-all hover:shadow-md border-2 border-transparent bg-card group"
              onClick={() => router.push("/sales/ai-upload")}
            >
              <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">AI Sales Invoice Generator</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Upload bills to generate sales invoices automatically.</p>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Upload any reference bill or existing invoice (PDF or Image). Gemini AI will extract customer details and item grids, map missing records on the fly, and pre-fill the invoice form.
                </p>
                <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                  Launch AI Generator &rarr;
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : activeSection === "template" ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveSection(null)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              &larr; Back to Settings
            </button>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Invoice Template Designer</h1>
            </div>
          </div>

          {/* ═══════════════ INVOICE TEMPLATE DESIGNER ═══════════════ */}
          <Card className="border-2 border-primary/20">
            <CardHeader className="bg-primary/5 rounded-t-lg border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5 text-primary" />
                Invoice Template Designer
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Customize how your PDF invoices look — upload a reference bill (e.g. from Tally) to match its style,
                choose fonts, and style each word of your company name individually.
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              {/* ─── 1. Reference Bill Upload ─── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileImage className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Reference Bill (Optional)</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload a bill generated by Tally or your current software. This serves as a visual reference
                  to replicate the layout in your PDF invoices.
                </p>
                <div className="flex items-start gap-4">
                  <label className="flex flex-col items-center justify-center w-40 h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground text-center px-2">
                      {templateImg ? "Change file" : "Upload PDF / Image"}
                    </span>
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleBillUpload} />
                  </label>
                  {templateImg && (
                    <div className="relative">
                      <img
                        src={templateImg}
                        alt="Reference bill"
                        className="h-32 rounded-lg border object-contain bg-gray-50"
                      />
                      <button
                        onClick={() => setTemplateImg(null)}
                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ─── 2. Global Font ─── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Invoice Font Style</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FONT_OPTIONS.map(f => (
                    <button
                      key={f.value}
                      onClick={() => setGlobalFont(f.value)}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        globalFont === f.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/50 hover:bg-muted/40"
                      }`}
                    >
                      <div className="text-xs text-muted-foreground mb-1">{f.label}</div>
                      <div style={{ fontFamily: f.value }} className="text-sm font-semibold truncate">
                        Invoice
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ─── 3. Company Name Word Styler ─── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Company Name Styling</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your company name is split word-by-word. Set a different size, weight, or color for each word.
                  For example: <strong>&quot;Siddhi&quot;</strong> can be large & bold, <strong>&quot;Electricals&quot;</strong> can be smaller and colored.
                </p>

                {words.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No company name set — edit your company profile first.</p>
                ) : (
                  <div className="space-y-4">
                    {words.map((word) => {
                      const ws = getWordStyle(word);
                      return (
                        <div key={word} className="rounded-lg border p-4 space-y-3 bg-muted/20">
                          <div className="flex items-center justify-between">
                            <span
                              className="text-lg font-semibold"
                              style={{
                                fontFamily: ws.fontFamily || globalFont,
                                fontSize: `${ws.fontSize}px`,
                                fontWeight: ws.fontWeight,
                                color: ws.color,
                                fontStyle: ws.italic ? "italic" : "normal",
                              }}
                            >
                              {word}
                            </span>
                            <button
                              onClick={() => resetWordStyle(word)}
                              className="text-xs text-muted-foreground hover:text-destructive underline"
                            >
                              Reset
                            </button>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {/* Font Family */}
                            <div className="col-span-2 sm:col-span-3">
                              <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">Font Family</label>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                {[{ label: "Same as Invoice", value: "" }, ...FONT_OPTIONS].map(f => (
                                  <button
                                    key={f.value}
                                    onClick={() => setWordStyleField(word, "fontFamily", f.value)}
                                    className={`rounded border px-2 py-1.5 text-left text-[11px] transition-all ${
                                      (ws.fontFamily || "") === f.value
                                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                                    }`}
                                  >
                                    <div className="text-[10px] text-muted-foreground truncate">{f.label}</div>
                                    <div style={{ fontFamily: f.value || globalFont }} className="font-semibold truncate">{word}</div>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Font Size */}
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">Size (px)</label>
                              <Input type="number" min={8} max={72} value={ws.fontSize} onChange={e => setWordStyleField(word, "fontSize", e.target.value)} className="h-8 text-sm" />
                            </div>

                            {/* Font Weight */}
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">Weight</label>
                              <select className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm" value={ws.fontWeight} onChange={e => setWordStyleField(word, "fontWeight", e.target.value)}>
                                {FONT_WEIGHTS.map(fw => <option key={fw.value} value={fw.value}>{fw.label}</option>)}
                              </select>
                            </div>

                            {/* Color + Italic */}
                            <div className="flex gap-2 items-end">
                              <div className="flex-1">
                                <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">Color</label>
                                <div className="flex items-center gap-1 h-8">
                                  <input type="color" value={ws.color} onChange={e => setWordStyleField(word, "color", e.target.value)} className="h-8 w-10 rounded border border-input cursor-pointer" />
                                  <span className="text-xs font-mono text-muted-foreground">{ws.color}</span>
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">Italic</label>
                                <button onClick={() => setWordStyleField(word, "italic", !ws.italic)} className={`h-8 px-3 rounded-md border text-sm transition-colors ${ws.italic ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/40"}`}>
                                  <em>I</em>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ─── 4. Live Preview ─── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Live Preview</h3>
                  </div>
                  <button onClick={() => setShowPreview(p => !p)} className="text-xs text-primary underline">
                    {showPreview ? "Hide preview" : "Show preview"}
                  </button>
                </div>
                {showPreview && <HeaderPreview />}
              </div>

              {/* ─── Save ─── */}
              <div className="flex items-center gap-3 pt-2 border-t">
                <Button onClick={saveTemplate} disabled={templateSaving} className="gap-2">
                  {templateSaving
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                    : <><Save className="h-4 w-4" /> Save Template Settings</>
                  }
                </Button>
                {templateSaved && (
                  <span className="text-sm text-emerald-600 font-medium">✓ Saved successfully!</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveSection(null)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              &larr; Back to Settings
            </button>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Product Master Names</h1>
            </div>
          </div>

          {/* ═══════════════ PRODUCT MASTER NAMES ═══════════════ */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Product Master Names</CardTitle>
              <p className="text-sm text-muted-foreground">
                Define the &quot;Real Product Names&quot; here. You can map vendor item names to these master names during AI upload to avoid duplicates.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAdd} className="flex gap-2">
                <Input
                  placeholder="e.g. Cement 50kg"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={saving}
                />
                <Button type="submit" disabled={saving || !newName.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Add Name
                </Button>
              </form>

              <div className="rounded-md border divide-y">
                {loading ? (
                  <div className="p-4 text-sm text-center text-muted-foreground">Loading...</div>
                ) : mappings.length === 0 ? (
                  <div className="p-4 text-sm text-center text-muted-foreground">No product names added yet.</div>
                ) : (
                  mappings.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                      <span className="font-medium">{m.realName}</span>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
