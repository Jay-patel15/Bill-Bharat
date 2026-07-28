"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Settings, Loader2, Upload, FileImage, Palette, Type, Eye, Save, X, Sparkles, FileSpreadsheet, AlignLeft } from "lucide-react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
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
  const [bulkText, setBulkText] = useState("");
  const [masterTab, setMasterTab] = useState("single"); // "single", "bulk", "csv"
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- Invoice Template state ---
  const [templateImg, setTemplateImg] = useState(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [globalFont, setGlobalFont] = useState("Inter, sans-serif");
  const [showPreview, setShowPreview] = useState(false);

  const companyName = active?.name || "";
  const words = companyName.split(/\s+/).filter(Boolean);

  const [wordStyles, setWordStyles] = useState({});

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

  async function loadMappings() {
    if (!active?.id) return;
    setLoading(true);
    try {
      setMappings(await api("/api/product-mappings") || []);
    } catch {
      setMappings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMappings();
  }, [active?.id]);

  if (!active) return <NoCompanySelected />;

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

  function handleBillUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setTemplateImg(ev.target.result);
    reader.readAsDataURL(file);
  }

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

  // --- Product Mappings Actions ---
  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await api("/api/product-mappings", {
        method: "POST",
        body: JSON.stringify({ realName: newName.trim() })
      });
      setNewName("");
      await loadMappings();
    } catch (err) {
      alert(err.message || "Failed to add name");
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkAdd(e) {
    e.preventDefault();
    const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setSaving(true);
    try {
      await api("/api/product-mappings", {
        method: "POST",
        body: JSON.stringify({ items: lines })
      });
      setBulkText("");
      await loadMappings();
      alert(`Successfully added ${lines.length} master product names!`);
    } catch (err) {
      alert(err.message || "Failed to add bulk items");
    } finally {
      setSaving(false);
    }
  }

  function handleCsvUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        const names = [];
        jsonRows.forEach(row => {
          if (Array.isArray(row)) {
            row.forEach(val => {
              if (val && typeof val === "string" && val.trim().length > 1) {
                names.push(val.trim());
              }
            });
          }
        });

        const uniqueNames = Array.from(new Set(names));
        if (uniqueNames.length === 0) {
          alert("No valid product names found in file.");
          setSaving(false);
          return;
        }

        await api("/api/product-mappings", {
          method: "POST",
          body: JSON.stringify({ items: uniqueNames })
        });

        await loadMappings();
        alert(`Successfully imported ${uniqueNames.length} master names from ${file.name}!`);
      } catch (err) {
        alert("Failed to parse CSV/Excel file: " + err.message);
      } finally {
        setSaving(false);
        e.target.value = null;
      }
    };
    reader.readAsArrayBuffer(file);
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
                  Upload template bill formats, set your favorite font styles, and configure per-word styling of your company name to build the perfect bill.
                </p>
                <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                  Configure Template &rarr;
                </div>
              </CardContent>
            </Card>

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
                  <p className="text-xs text-muted-foreground mt-0.5">Upload or type master product list via CSV / Manual entry.</p>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Prevent duplicates during AI invoice uploads. Upload CSV files or paste item names to create your master product catalogue.
                </p>
                <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                  Manage Product Master &rarr;
                </div>
              </CardContent>
            </Card>

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
                  Upload any reference bill or existing invoice (PDF or Image). Gemini AI will extract customer details and item grids.
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

          <Card className="border-2 border-primary/20">
            <CardHeader className="bg-primary/5 rounded-t-lg border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5 text-primary" />
                Invoice Template Designer
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileImage className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Reference Bill (Optional)</h3>
                </div>
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
                      <img src={templateImg} alt="Reference bill" className="h-32 rounded-lg border object-contain bg-gray-50" />
                      <button onClick={() => setTemplateImg(null)} className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

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
                        globalFont === f.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50 hover:bg-muted/40"
                      }`}
                    >
                      <div className="text-xs text-muted-foreground mb-1">{f.label}</div>
                      <div style={{ fontFamily: f.value }} className="text-sm font-semibold truncate">Invoice</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t">
                <Button onClick={saveTemplate} disabled={templateSaving} className="gap-2">
                  {templateSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Template Settings</>}
                </Button>
                {templateSaved && <span className="text-sm text-emerald-600 font-medium">✓ Saved successfully!</span>}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => setActiveSection(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              &larr; Back to Settings
            </button>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Product Master Names</h1>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Product Master Catalogue</CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload CSV / Excel files or type master product names to auto-link extracted vendor item names during AI upload.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Method Tabs */}
              <div className="flex items-center gap-2 border-b pb-2">
                <button
                  onClick={() => setMasterTab("single")}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${masterTab === "single" ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground"}`}
                >
                  <Plus className="h-3.5 w-3.5 inline mr-1" />
                  Single Add
                </button>
                <button
                  onClick={() => setMasterTab("bulk")}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${masterTab === "bulk" ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground"}`}
                >
                  <AlignLeft className="h-3.5 w-3.5 inline mr-1" />
                  Manual Typing / Copy-Paste
                </button>
                <button
                  onClick={() => setMasterTab("csv")}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${masterTab === "csv" ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground"}`}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 inline mr-1" />
                  Upload CSV / Excel File
                </button>
              </div>

              {/* 1. Single Add */}
              {masterTab === "single" && (
                <form onSubmit={handleAdd} className="flex gap-2">
                  <Input
                    placeholder="e.g. 20MM PVC Pipe"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={saving}
                  />
                  <Button type="submit" disabled={saving || !newName.trim()}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    Add Master Product
                  </Button>
                </form>
              )}

              {/* 2. Manual Typing / Copy Paste */}
              {masterTab === "bulk" && (
                <form onSubmit={handleBulkAdd} className="space-y-3">
                  <label className="text-xs text-muted-foreground block font-medium">
                    Type or paste product master names (one item per line):
                  </label>
                  <Textarea
                    rows={5}
                    placeholder={"20MM PVC Pipe\n25MM PVC Pipe\nSolvent Cement 250ml\nJunction Box 20mm"}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    disabled={saving}
                  />
                  <Button type="submit" disabled={saving || !bulkText.trim()}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    Bulk Save Master Names
                  </Button>
                </form>
              )}

              {/* 3. CSV / Excel Upload */}
              {masterTab === "csv" && (
                <div className="space-y-3">
                  <label className="text-xs text-muted-foreground block font-medium">
                    Upload a CSV or Excel spreadsheet containing your master product names list:
                  </label>
                  <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                    <FileSpreadsheet className="h-8 w-8 text-primary mb-2" />
                    <span className="text-sm font-medium">Click to select CSV or Excel (.xlsx) file</span>
                    <span className="text-xs text-muted-foreground mt-1">Accepts .csv, .xlsx, .xls</span>
                    <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCsvUpload} disabled={saving} />
                  </label>
                </div>
              )}

              {/* Master list display table */}
              <div>
                <div className="text-sm font-semibold mb-2">Master Product Catalogue ({mappings.length})</div>
                <div className="rounded-md border divide-y max-h-[400px] overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-sm text-center text-muted-foreground">Loading...</div>
                  ) : mappings.length === 0 ? (
                    <div className="p-4 text-sm text-center text-muted-foreground">No product master names added yet.</div>
                  ) : (
                    mappings.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                        <span className="font-medium text-sm">{m.realName}</span>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
