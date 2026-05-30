"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, Upload, FileCheck, Loader2, X, RefreshCw, Plus, Trash2,
  CheckCircle2, AlertCircle, ArrowRight, UserPlus, PackagePlus, FileText, Link2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";
import { gstStateFromGstin, GST_SLABS } from "@/lib/gst";
import { formatINR, STATES } from "@/lib/utils";
import { NoCompanySelected } from "@/components/empty-state";

export default function AiSalesUploadPage() {
  const router = useRouter();
  const toast = useToast();
  const { active } = useCompany();

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  
  // Database entities
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  
  // Resolution states
  const [resolvedCustomerId, setResolvedCustomerId] = useState("");
  
  // Local storage check on mount (if reference bill was passed from settings)
  useEffect(() => {
    const savedBase64 = localStorage.getItem("sales_invoice_ai_file_base64");
    if (savedBase64) {
      localStorage.removeItem("sales_invoice_ai_file_base64");
      // Convert base64 data url back to a File object
      fetch(savedBase64)
        .then(res => res.blob())
        .then(blob => {
          const loadedFile = new File([blob], "settings-reference-bill." + (blob.type.split("/")[1] || "png"), { type: blob.type });
          setFile(loadedFile);
        })
        .catch(err => console.error("Failed to load reference bill file:", err));
    }
  }, []);

  // Generate / revoke object URL when file changes
  useEffect(() => {
    if (!file) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Load database entities
  const loadEntities = () => {
    if (!active?.id) return;
    api("/api/customers").then(setCustomers).catch(() => setCustomers([]));
    api("/api/inventory").then(setInventory).catch(() => setInventory([]));
  };

  useEffect(() => {
    loadEntities();
  }, [active?.id]);

  async function parseInvoice() {
    if (!file) return;
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ai/parse-sales", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      
      const data = json.data;
      
      // Look for customer match in current DB
      const matchedCust = customers.find(c => 
        c.name?.toLowerCase() === data.customerName?.toLowerCase() ||
        (c.gstNumber && data.customerGst && c.gstNumber.replace(/[^A-Z0-9]/ig, '').toLowerCase() === data.customerGst.replace(/[^A-Z0-9]/ig, '').toLowerCase())
      );
      
      if (matchedCust) {
        setResolvedCustomerId(matchedCust.id);
      } else {
        setResolvedCustomerId("");
      }

      // Look for items match in inventory
      const normalizedItems = (data.items || []).map((it) => {
        const matchedItem = inventory.find(x => x.name?.toLowerCase() === it.name?.toLowerCase());
        return {
          name: matchedItem ? matchedItem.name : (it.name || ""),
          extractedName: it.name || "",
          hsnCode: it.hsnCode || "",
          quantity: Number(it.quantity) || 1,
          unit: it.unit || "PCS",
          sellingPrice: Number(it.sellingPrice) || 0,
          gstRate: Number(it.gstRate) || 18,
          discount: Number(it.discount) || 0,
          inventoryId: matchedItem ? matchedItem.id : "",
          isResolved: !!matchedItem
        };
      });

      setParsed({
        customerName: data.customerName || "",
        customerGst: data.customerGst || "",
        customerAddress: data.customerAddress || "",
        customerPhone: data.customerPhone || "",
        customerEmail: data.customerEmail || "",
        customerState: data.customerState || "",
        customerStateCode: data.customerStateCode || "",
        invoiceNumber: data.invoiceNumber || "",
        invoiceDate: data.invoiceDate || new Date().toISOString().slice(0, 10),
        dueDate: data.dueDate || "",
        items: normalizedItems,
        discount: Number(data.discount) || 0,
        notes: data.notes || ""
      });
      
      toast({ type: "success", title: "Invoice extracted successfully!" });
    } catch (e) {
      toast({ type: "error", title: "Extraction failed", message: e.message });
    } finally { setParsing(false); }
  }

  // Check if everything is resolved
  const isCustomerResolved = !!resolvedCustomerId;
  const isItemsResolved = parsed?.items ? parsed.items.every(it => it.isResolved) : false;
  const isFullyResolved = isCustomerResolved && isItemsResolved;

  // Render file picker if not parsed
  if (!parsed) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" /> AI Sales Invoice Generator
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload an existing invoice image or PDF. Gemini AI will read client and product info, help you verify mapping against the DB, and pre-populate your sales invoice.
          </p>
        </div>

        <Card className="max-w-2xl border-2 border-dashed border-primary/20 bg-gradient-to-br from-background to-amber-50/10">
          <CardContent className="p-10 space-y-6">
            <label className="block border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:bg-amber-50/20 hover:border-amber-500/50 transition-all duration-300 group">
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <div className="rounded-full bg-amber-500/10 w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <Upload className="h-8 w-8 text-amber-600" />
              </div>
              <div className="mt-3 font-semibold text-lg">{file ? file.name : "Click to select or drag invoice"}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {file ? `${Math.round(file.size / 1024)} KB` : "Supports PDFs, PNG, JPG, or WEBP up to 10 MB"}
              </div>
            </label>

            <Button disabled={!file || parsing} onClick={parseInvoice} className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium py-6 shadow-md rounded-xl transition-all duration-200">
              {parsing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Gemini parsing invoice layout...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Analyze Reference Bill with AI
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedCustomer = customers.find(c => c.id === resolvedCustomerId);
  const isImage = file?.type.startsWith("image/");

  // Trigger redirection after resolved
  function proceedToInvoice() {
    if (!isFullyResolved) return;
    
    const draft = {
      customerId: resolvedCustomerId,
      invoiceNumber: parsed.invoiceNumber,
      invoiceDate: parsed.invoiceDate,
      dueDate: parsed.dueDate,
      items: parsed.items.map(it => ({
        inventoryId: it.inventoryId,
        name: it.name,
        hsnCode: it.hsnCode,
        quantity: it.quantity,
        sellingPrice: it.sellingPrice,
        gstRate: it.gstRate,
        discount: it.discount,
        unit: it.unit
      })),
      discount: parsed.discount,
      notes: parsed.notes
    };

    localStorage.setItem("sales_invoice_ai_draft", JSON.stringify(draft));
    toast({ type: "success", title: "Draft ready!", message: "Opening Sales Invoice Creator..." });
    router.push("/sales/create-invoice?source=ai");
  }

  function reset() {
    setParsed(null);
    setFile(null);
    setResolvedCustomerId("");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" /> AI Sales Invoice Generator
          </h1>
          <p className="text-xs text-muted-foreground">
            Map missing customer and item master data to ensure accounting integrity.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          <X className="h-3.5 w-3.5 mr-1" /> Clear & Upload Another
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ───── LEFT: Invoice Preview ───── */}
        <Card className="overflow-hidden shadow-md border bg-card">
          <CardHeader className="p-4 border-b bg-muted/20">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" />
              Source Invoice Document
            </CardTitle>
          </CardHeader>
          <div className="bg-slate-50 flex items-center justify-center" style={{ height: 680 }}>
            {previewUrl ? (
              isImage ? (
                <img src={previewUrl} className="max-w-full max-h-full object-contain p-2" alt="Uploaded reference bill" />
              ) : (
                <iframe src={previewUrl} className="w-full h-full border-none" title="PDF preview" />
              )
            ) : (
              <div className="text-sm text-muted-foreground">No preview available</div>
            )}
          </div>
        </Card>

        {/* ───── RIGHT: Verification & Mapping Wizard ───── */}
        <div className="space-y-4 max-h-[740px] overflow-y-auto pr-1">
          {/* STEP 1: Customer Resolution */}
          <CustomerResolver
            parsedCustomer={{
              name: parsed.customerName,
              gstNumber: parsed.customerGst,
              address: parsed.customerAddress,
              phone: parsed.customerPhone,
              email: parsed.customerEmail,
              state: parsed.customerState,
              stateCode: parsed.customerStateCode
            }}
            customers={customers}
            resolvedCustomerId={resolvedCustomerId}
            onResolve={(id) => setResolvedCustomerId(id)}
            onCustomerCreated={(newCust) => {
              setCustomers(prev => [...prev, newCust]);
              setResolvedCustomerId(newCust.id);
            }}
          />

          {/* STEP 2: Items Resolution (Only active when customer is resolved) */}
          {isCustomerResolved ? (
            <ItemsResolver
              parsedItems={parsed.items}
              inventory={inventory}
              onItemMapped={(idx, mappedItem) => {
                setParsed(prev => {
                  const updatedItems = [...prev.items];
                  updatedItems[idx] = {
                    ...updatedItems[idx],
                    inventoryId: mappedItem.id,
                    name: mappedItem.name,
                    matchedName: mappedItem.name,
                    isResolved: true
                  };
                  return { ...prev, items: updatedItems };
                });
              }}
              onProductCreated={(idx, newProd) => {
                setInventory(prev => [...prev, newProd]);
                setParsed(prev => {
                  const updatedItems = [...prev.items];
                  updatedItems[idx] = {
                    ...updatedItems[idx],
                    inventoryId: newProd.id,
                    name: newProd.name,
                    matchedName: newProd.name,
                    isResolved: true
                  };
                  return { ...prev, items: updatedItems };
                });
              }}
              onResetItem={(idx) => {
                setParsed(prev => {
                  const updatedItems = [...prev.items];
                  updatedItems[idx] = {
                    ...updatedItems[idx],
                    inventoryId: "",
                    matchedName: "",
                    isResolved: false
                  };
                  return { ...prev, items: updatedItems };
                });
              }}
            />
          ) : (
            <Card className="opacity-60 bg-muted/10 border-dashed">
              <CardContent className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
                <span>Please resolve customer mapping first to unlock item resolution.</span>
              </CardContent>
            </Card>
          )}

          {/* STEP 3: Summary & Proceed */}
          {isFullyResolved && (
            <Card className="border-2 border-emerald-500 bg-emerald-50/10 shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-300">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>All customer and item profiles resolved successfully!</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Click below to open the sales invoice creator with all resolved fields, quantities, and GST details prefilled.
                </p>
                <Button
                  onClick={proceedToInvoice}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-4 flex items-center justify-center gap-2 rounded-lg"
                >
                  Proceed to Sales Invoice Builder
                  <ArrowRight className="h-4 w-4 animate-pulse" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────── CUSTOMER RESOLUTION COMPONENT ────────────────
function CustomerResolver({ parsedCustomer, customers, resolvedCustomerId, onResolve, onCustomerCreated }) {
  const toast = useToast();
  const [mode, setMode] = useState("choose"); // "choose", "create"
  const [creating, setCreating] = useState(false);

  // New Customer Form State
  const [form, setForm] = useState({
    name: parsedCustomer.name || "",
    gstNumber: parsedCustomer.gstNumber || "",
    address: parsedCustomer.address || "",
    phone: parsedCustomer.phone || "",
    email: parsedCustomer.email || "",
    stateCode: parsedCustomer.stateCode || "",
    state: parsedCustomer.state || ""
  });

  // Prefill state and code if GSTIN is present
  useEffect(() => {
    if (form.gstNumber && form.gstNumber.length >= 2) {
      const code = form.gstNumber.substring(0, 2);
      const s = STATES.find(([c]) => c === code);
      if (s) {
        setForm(prev => ({ ...prev, stateCode: code, state: s[1] }));
      }
    }
  }, [form.gstNumber]);

  const activeCustomer = customers.find(c => c.id === resolvedCustomerId);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const created = await api("/api/customers", {
        method: "POST",
        body: JSON.stringify(form)
      });
      onCustomerCreated(created);
      toast({ type: "success", title: "Customer profile created", message: created.name });
    } catch (e) {
      toast({ type: "error", title: "Failed to create customer", message: e.message });
    } finally { setCreating(false); }
  }

  return (
    <Card className={`border shadow-sm ${resolvedCustomerId ? "border-emerald-500/30 bg-emerald-50/5" : "border-amber-500/50 bg-amber-50/5"}`}>
      <CardHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {resolvedCustomerId ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          )}
          Customer Resolution
        </CardTitle>
        {resolvedCustomerId && (
          <Button variant="ghost" size="xs" onClick={() => onResolve("")} className="text-xs text-muted-foreground underline">
            Change Match
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {resolvedCustomerId ? (
          <div className="space-y-1.5">
            <div className="text-sm font-medium text-foreground">Matched: <span className="font-bold text-emerald-600">{activeCustomer?.name}</span></div>
            {activeCustomer?.gstNumber && <div className="text-xs text-muted-foreground">GSTIN: {activeCustomer.gstNumber}</div>}
            {activeCustomer?.address && <div className="text-xs text-muted-foreground">Address: {activeCustomer.address}</div>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-500/10 text-amber-800 text-xs p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <strong>Customer not recognized:</strong>
                <p className="mt-1">Extracted name <b>&quot;{parsedCustomer.name || "N/A"}&quot;</b> does not exist in your database.</p>
              </div>
            </div>

            <div className="flex gap-2 border-b pb-2">
              <button
                onClick={() => setMode("choose")}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${mode === "choose" ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground"}`}
              >
                <Link2 className="h-3 w-3 inline mr-1" />
                Link to Existing Customer
              </button>
              <button
                onClick={() => setMode("create")}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${mode === "create" ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground"}`}
              >
                <UserPlus className="h-3.5 w-3.5 inline mr-1" />
                Create New Customer Profile
              </button>
            </div>

            {mode === "choose" ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Select customer from database:</label>
                <SearchableSelect
                  options={customers.map(c => ({ value: c.id, label: c.name + (c.gstNumber ? ` · ${c.gstNumber}` : "") }))}
                  value={resolvedCustomerId}
                  onChange={(val) => onResolve(val)}
                  placeholder="-- Search Customers --"
                />
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-3 bg-muted/20 p-3 rounded-lg border">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] uppercase font-semibold text-muted-foreground">Customer Name</label>
                    <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-muted-foreground">GSTIN</label>
                    <Input value={form.gstNumber} onChange={e => setForm({ ...form, gstNumber: e.target.value.toUpperCase() })} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-muted-foreground">State</label>
                    <Select
                      value={form.stateCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const s = STATES.find(([c]) => c === code);
                        setForm({ ...form, stateCode: code, state: s ? s[1] : "" });
                      }}
                      className="h-8 text-xs"
                    >
                      <option value="">— Select State —</option>
                      {STATES.map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-muted-foreground">Phone</label>
                    <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-muted-foreground">Email</label>
                    <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] uppercase font-semibold text-muted-foreground">Address</label>
                    <Textarea rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="text-xs p-2" />
                  </div>
                </div>
                <Button type="submit" disabled={creating || !form.name.trim()} className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white h-9 text-xs">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-3.5 w-3.5 mr-1" />}
                  Create & Link Customer
                </Button>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────── ITEMS RESOLUTION COMPONENT ────────────────
function ItemsResolver({ parsedItems, inventory, onItemMapped, onProductCreated, onResetItem }) {
  return (
    <Card className="border shadow-sm">
      <CardHeader className="p-4 border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <PackagePlus className="h-4 w-4 text-primary" />
          Product Master & Inventory Matching
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground mb-1">
          Link the extracted invoice line items to your inventory records or create missing products.
        </p>
        <div className="space-y-3">
          {parsedItems.map((item, idx) => (
            <ItemRowResolver
              key={idx}
              idx={idx}
              item={item}
              inventory={inventory}
              onResolve={(mapped) => onItemMapped(idx, mapped)}
              onProductCreated={(prod) => onProductCreated(idx, prod)}
              onReset={() => onResetItem(idx)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ItemRowResolver({ idx, item, inventory, onResolve, onProductCreated, onReset }) {
  const toast = useToast();
  const [mode, setMode] = useState("choose"); // "choose", "create"
  const [creating, setCreating] = useState(false);

  // New Product Form State
  const [form, setForm] = useState({
    name: item.extractedName || "",
    sku: "",
    hsnCode: item.hsnCode || "",
    sellingPrice: item.sellingPrice || 0,
    purchasePrice: 0,
    gstRate: item.gstRate || 18,
    unit: item.unit || "PCS",
    quantity: 0
  });

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const created = await api("/api/inventory", {
        method: "POST",
        body: JSON.stringify(form)
      });
      onProductCreated(created);
      toast({ type: "success", title: "Product added to inventory", message: created.name });
    } catch (e) {
      toast({ type: "error", title: "Failed to create product", message: e.message });
    } finally { setCreating(false); }
  }

  return (
    <div className={`p-3 rounded-lg border-2 transition-all ${item.isResolved ? "border-emerald-500/20 bg-emerald-50/5" : "border-amber-500/40 bg-amber-50/5 shadow-sm"}`}>
      <div className="flex items-start justify-between gap-2 border-b pb-2 mb-2">
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase">Extracted Item Name:</div>
          <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            {item.extractedName}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Extracted Rate: {formatINR(item.sellingPrice)} | GST: {item.gstRate}% | Qty: {item.quantity} {item.unit}
          </div>
        </div>
        {item.isResolved ? (
          <div className="flex items-center gap-2">
            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">Mapped ✓</span>
            <Button variant="ghost" size="icon" onClick={onReset} className="h-6 w-6"><X className="h-3 w-3" /></Button>
          </div>
        ) : (
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">Unlinked ⚠</span>
        )}
      </div>

      {!item.isResolved && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("choose")}
              className={`text-[11px] px-2.5 py-1 rounded border font-medium transition-colors ${mode === "choose" ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground"}`}
            >
              <Link2 className="h-2.5 w-2.5 inline mr-1" />
              Link to Master Product
            </button>
            <button
              onClick={() => setMode("create")}
              className={`text-[11px] px-2.5 py-1 rounded border font-medium transition-colors ${mode === "create" ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground"}`}
            >
              <Plus className="h-3 w-3 inline mr-1" />
              Create Master Product
            </button>
          </div>

          {mode === "choose" ? (
            <div className="flex items-center gap-2">
              <SearchableSelect
                options={inventory.map(inv => ({ value: inv.id, label: inv.name + (inv.sku ? ` (${inv.sku})` : "") }))}
                value={item.inventoryId}
                onChange={(val) => {
                  const invItem = inventory.find(x => x.id === val);
                  if (invItem) onResolve(invItem);
                }}
                placeholder="-- Select product from inventory --"
              />
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-2.5 bg-muted/20 p-2.5 border rounded-md">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-3">
                  <label className="text-[9px] uppercase font-semibold text-muted-foreground">Product Name</label>
                  <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-7 text-xs" />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-semibold text-muted-foreground">HSN Code</label>
                  <Input value={form.hsnCode} onChange={e => setForm({ ...form, hsnCode: e.target.value })} className="h-7 text-xs" />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-semibold text-muted-foreground">SKU / Code</label>
                  <Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className="h-7 text-xs" />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-semibold text-muted-foreground">Unit</label>
                  <Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="h-7 text-xs" />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-semibold text-muted-foreground">Selling Price</label>
                  <Input type="number" min={0} step="0.01" value={form.sellingPrice} onChange={e => setForm({ ...form, sellingPrice: Number(e.target.value) })} className="h-7 text-xs" />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-semibold text-muted-foreground">GST Rate%</label>
                  <Select value={form.gstRate} onChange={e => setForm({ ...form, gstRate: Number(e.target.value) })} className="h-7 text-xs">
                    {GST_SLABS.map(r => <option key={r} value={r}>{r}%</option>)}
                  </Select>
                </div>
              </div>
              <Button type="submit" disabled={creating || !form.name.trim()} className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white h-8 text-xs font-semibold">
                {creating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                Add Product to Inventory
              </Button>
            </form>
          )}
        </div>
      )}

      {item.isResolved && (
        <div className="text-xs text-emerald-700 font-medium mt-1 pl-5 border-l-2 border-emerald-500">
          Linked to Inventory: <b>{item.name}</b>
        </div>
      )}
    </div>
  );
}

// ──────────────── SEARCHABLE SELECT COMPONENT ────────────────
function SearchableSelect({ options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayValue = options.find(o => o.value === value)?.label || "";

  return (
    <div className="relative flex-1" ref={ref}>
      <div 
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background cursor-pointer hover:bg-muted/30"
        onClick={() => setOpen(!open)}
      >
        <span className={displayValue ? "" : "text-muted-foreground"}>{displayValue || placeholder}</span>
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full z-50 bg-background border rounded-md shadow-md max-h-56 flex flex-col overflow-hidden">
          <div className="p-1.5 border-b bg-muted/20">
            <input 
              autoFocus
              className="h-8 w-full text-xs px-2 bg-transparent outline-none border rounded bg-background" 
              placeholder="Type to search..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <div className="overflow-y-auto p-1 bg-background">
            {options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).map(o => (
              <div 
                key={o.value} 
                className={`px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer rounded-sm ${o.value === value ? "bg-accent/50 font-medium" : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setSearch("");
                }}
              >
                {o.label}
              </div>
            ))}
            {options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">No matches found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
