"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, RefreshCw, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";
import { computeInvoice, gstStateFromGstin, GST_SLABS } from "@/lib/gst";
import { formatINR, nextInvoiceNumber, DOCUMENT_TYPES, getDocumentType, formatInvoiceNotes, STATES } from "@/lib/utils";
import { NoCompanySelected } from "@/components/empty-state";

const blankItem = () => ({
  inventoryId: "", name: "", hsnCode: "", quantity: 1,
  sellingPrice: 0, gstRate: 18, discount: 0, unit: "PCS"
});

export default function CreateInvoicePage() {
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();
  const { active } = useCompany();

  const [docType, setDocType] = useState(search.get("type") || "Tax Invoice");
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [projects, setProjects] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [customerId, setCustomerId] = useState(search.get("customer") || "");
  const [projectId, setProjectId] = useState(search.get("project") || "");
  const [boqDialog, setBoqDialog] = useState(false);
  const [boqPicks, setBoqPicks] = useState({});
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [items, setItems] = useState([blankItem()]);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [numberDirty, setNumberDirty] = useState(false);
  const [showTransport, setShowTransport] = useState(false);
  const [transport, setTransport] = useState({
    challanNumber: "",
    challanDate: "",
    orderNumber: "",
    orderDate: "",
    lrNumber: "",
    lrDate: "",
    transporter: "",
    ewayNumber: "",
    paymentTerms: "",
    consigneeSameAsBuyer: true,
    consigneeName: "",
    consigneeAddress: "",
    consigneeGst: "",
    consigneePhone: "",
    consigneeState: "",
    consigneeStateCode: ""
  });

  useEffect(() => {
    if (!active?.id) return;
    api("/api/customers").then(setCustomers).catch(() => setCustomers([]));
    api("/api/inventory").then(setInventory).catch(() => setInventory([]));
    api("/api/projects").then(setProjects).catch(() => setProjects([]));
    api("/api/sales").then(setAllSales).catch(() => setAllSales([]));
  }, [active?.id]);

  useEffect(() => {
    if (search.get("source") === "ai") {
      try {
        const raw = localStorage.getItem("sales_invoice_ai_draft");
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft.customerId) setCustomerId(draft.customerId);
          if (draft.invoiceNumber) {
            setInvoiceNumber(draft.invoiceNumber);
            setNumberDirty(true);
          }
          if (draft.invoiceDate) setInvoiceDate(draft.invoiceDate);
          if (draft.dueDate) setDueDate(draft.dueDate);
          if (draft.discount) setDiscount(draft.discount);
          if (draft.notes) setNotes(draft.notes);
          if (Array.isArray(draft.items) && draft.items.length > 0) {
            setItems(draft.items);
          }
          localStorage.removeItem("sales_invoice_ai_draft");
          toast({ type: "success", title: "Sales Invoice Prefilled", message: "Loaded details extracted by Gemini AI." });
        }
      } catch (e) {
        console.error("Failed to load AI draft:", e);
      }
    }
  }, [search]);

  // When the user picks a customer, narrow projects to theirs.
  // When they pick a project, lock the customer.
  const projectsForCustomer = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    const matched = projects.filter((p) => !customerId || !p.customerId || p.customerId === customerId);
    return matched.length > 0 ? matched : projects;
  }, [projects, customerId]);

  const selectedProject = projects.find((p) => p.id === projectId) || null;
  useEffect(() => {
    if (selectedProject && selectedProject.customerId && customerId !== selectedProject.customerId) {
      setCustomerId(selectedProject.customerId);
    }
  }, [selectedProject?.id]);

  // Auto-suggest the next number whenever doc type or sales list changes
  // (but don't overwrite if the user has edited it).
  useEffect(() => {
    if (numberDirty) return;
    const dt = getDocumentType(docType);
    setInvoiceNumber(nextInvoiceNumber(allSales.map((s) => s.invoiceNumber), dt.prefix));
  }, [docType, allSales, numberDirty]);

  const dt = getDocumentType(docType);
  const customer = customers.find((c) => c.id === customerId);
  const supplierStateCode = active?.stateCode || gstStateFromGstin(active?.gstNumber || "");
  const recipientStateCode = customer?.stateCode || gstStateFromGstin(customer?.gstNumber || "") || supplierStateCode;

  const computed = useMemo(() => {
    const c = computeInvoice({ items, supplierStateCode, recipientStateCode, invoiceDiscount: Number(discount) || 0 });
    if (!dt.taxable) {
      for (const it of c.items) { it.cgst = it.sgst = it.igst = 0; it.total = it.taxable; }
      c.cgst = c.sgst = c.igst = 0;
      c.grandTotal = c.subtotal - (Number(discount) || 0);
    }
    return c;
  }, [items, supplierStateCode, recipientStateCode, discount, dt.taxable]);

  function setItem(i, patch) { setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it)); }
  function pickInventory(i, invId) {
    const inv = inventory.find((x) => x.id === invId);
    if (!inv) return setItem(i, { inventoryId: "" });
    setItem(i, {
      inventoryId: inv.id,
      name: inv.name,
      hsnCode: inv.hsnCode || "",
      sellingPrice: Number(inv.sellingPrice) || 0,
      gstRate: Number(inv.gstRate) || 0,
      unit: inv.unit || "PCS"
    });
  }
  function regenerateNumber() {
    setNumberDirty(false);
    setInvoiceNumber(nextInvoiceNumber(allSales.map((s) => s.invoiceNumber), dt.prefix));
  }

  async function save() {
    if (!customerId) return toast({ type: "error", title: "Pick a customer" });
    if (items.length === 0 || items.some((i) => !i.name)) return toast({ type: "error", title: "Add at least one named item" });
    setSaving(true);
    try {
      const created = await api("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          documentType: docType,
          invoiceNumber: invoiceNumber.trim(),
          customerId, projectId,
          invoiceDate, dueDate, items,
          discount: Number(discount) || 0,
          amountPaid: Number(amountPaid) || 0,
          notes: formatInvoiceNotes(notes, transport)
        })
      });
      toast({ type: "success", title: `${docType} created`, message: created.invoiceNumber });
      router.replace(`/sales/${created.id}`);
    } catch (e) {
      toast({ type: "error", title: "Could not save", message: e.message });
    } finally { setSaving(false); }
  }

  if (!active) return <NoCompanySelected />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">New {docType}</h1>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : `Save ${docType}`}</Button>
      </div>

      {/* Doc-type pill bar */}
      <div className="flex flex-wrap gap-2">
        {DOCUMENT_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setDocType(t.value)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              docType === t.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-accent"
            }`}
          >
            {t.value}
            <span className="ml-2 text-[10px] opacity-70">{t.prefix}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Document details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label={`${docType} number *`}>
              <div className="flex gap-2">
                <Input value={invoiceNumber} onChange={(e) => { setInvoiceNumber(e.target.value); setNumberDirty(true); }} />
                <Button type="button" variant="outline" size="icon" onClick={regenerateNumber} title="Auto-generate">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </Field>
            <Field label="Customer *">
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.gstNumber ? ` · ${c.gstNumber}` : ""}</option>)}
              </Select>
            </Field>
            <Field label="Date"><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></Field>
            <Field label={dt.value === "Purchase Order" ? "Expected delivery" : "Due date"}>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="Project (optional)" hint={selectedProject ? `Contract: ${formatINR(selectedProject.contractValue || 0)}` : "Bill against a BOQ-driven project"}>
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">— None —</option>
                {projectsForCustomer.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              {selectedProject && Array.isArray(selectedProject.boqItems) && selectedProject.boqItems.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const init = {};
                    selectedProject.boqItems.forEach((_, i) => { init[i] = { picked: true, qty: selectedProject.boqItems[i].quantity }; });
                    setBoqPicks(init);
                    setBoqDialog(true);
                  }}
                >
                  <Layers className="h-4 w-4" /> Bill from BOQ
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex justify-between items-center flex-row">
            <CardTitle>Transport & Consignee Details</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTransport(!showTransport)}
            >
              {showTransport ? "Hide details" : "Add dispatch / consignee details"}
            </Button>
          </CardHeader>
          {showTransport && (
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Challan Number"><Input value={transport.challanNumber} onChange={(e) => setTransport({ ...transport, challanNumber: e.target.value })} /></Field>
                <Field label="Challan Date"><Input type="date" value={transport.challanDate} onChange={(e) => setTransport({ ...transport, challanDate: e.target.value })} /></Field>
                <Field label="Credit Days / Terms"><Input placeholder="e.g. 45 Days" value={transport.paymentTerms} onChange={(e) => setTransport({ ...transport, paymentTerms: e.target.value })} /></Field>
                
                <Field label="Order Number"><Input value={transport.orderNumber} onChange={(e) => setTransport({ ...transport, orderNumber: e.target.value })} /></Field>
                <Field label="Order Date"><Input type="date" value={transport.orderDate} onChange={(e) => setTransport({ ...transport, orderDate: e.target.value })} /></Field>
                <Field label="Transporter Name"><Input placeholder="e.g. PORTER" value={transport.transporter} onChange={(e) => setTransport({ ...transport, transporter: e.target.value })} /></Field>

                <Field label="L.R. Number"><Input value={transport.lrNumber} onChange={(e) => setTransport({ ...transport, lrNumber: e.target.value })} /></Field>
                <Field label="L.R. Date"><Input type="date" value={transport.lrDate} onChange={(e) => setTransport({ ...transport, lrDate: e.target.value })} /></Field>
                <Field label="E-way Bill Number"><Input value={transport.ewayNumber} onChange={(e) => setTransport({ ...transport, ewayNumber: e.target.value })} /></Field>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="consigneeSameAsBuyer"
                    checked={transport.consigneeSameAsBuyer}
                    onChange={(e) => setTransport({ ...transport, consigneeSameAsBuyer: e.target.checked })}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <label htmlFor="consigneeSameAsBuyer" className="text-sm font-medium select-none">
                    Consignee Details (Ship To) same as Buyer (Bill To)
                  </label>
                </div>

                {!transport.consigneeSameAsBuyer && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Consignee Name"><Input required value={transport.consigneeName} onChange={(e) => setTransport({ ...transport, consigneeName: e.target.value })} /></Field>
                    <Field label="Consignee Phone"><Input value={transport.consigneePhone} onChange={(e) => setTransport({ ...transport, consigneePhone: e.target.value })} /></Field>
                    <Field label="Consignee GSTIN">
                      <Input
                        value={transport.consigneeGst}
                        onChange={(e) => {
                          const v = e.target.value.toUpperCase();
                          setTransport({
                            ...transport,
                            consigneeGst: v,
                            consigneeStateCode: v.length >= 2 ? v.substring(0, 2) : transport.consigneeStateCode
                          });
                        }}
                      />
                    </Field>
                    <Field label="Consignee State">
                      <Select
                        value={transport.consigneeStateCode || ""}
                        onChange={(e) => {
                          const code = e.target.value;
                          const s = STATES.find(([c]) => c === code);
                          setTransport({ ...transport, consigneeStateCode: code, consigneeState: s ? s[1] : "" });
                        }}
                      >
                        <option value="">—</option>
                        {STATES.map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
                      </Select>
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Consignee Address"><Textarea rows={2} value={transport.consigneeAddress} onChange={(e) => setTransport({ ...transport, consigneeAddress: e.target.value })} /></Field>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatINR(computed.subtotal)} />
            {dt.taxable && (computed.interstate
              ? <Row label="IGST" value={formatINR(computed.igst)} />
              : (<><Row label="CGST" value={formatINR(computed.cgst)} /><Row label="SGST" value={formatINR(computed.sgst)} /></>))}
            <Row label="Discount" value={"- " + formatINR(computed.invoiceDiscount)} />
            <div className="border-t pt-2">
              <Row label={<strong>Grand Total</strong>} value={<strong>{formatINR(computed.grandTotal)}</strong>} />
            </div>
            <div className="text-[11px] text-muted-foreground pt-1">
              {!dt.taxable
                ? "Non-taxable document — no GST applied."
                : (computed.interstate ? "Interstate (IGST)" : "Intrastate (CGST + SGST)")}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Items</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setItems((a) => [...a, blankItem()])}>
            <Plus className="h-3.5 w-3.5" /> Add row
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className={`grid gap-2 text-xs text-muted-foreground px-2 ${
            dt.taxable
              ? "grid-cols-[2fr_1fr_0.6fr_1fr_0.8fr_0.8fr_1fr_2.4rem]"
              : "grid-cols-[3fr_1fr_0.7fr_1fr_2.4rem]"
          }`}>
            <div>Item</div>
            <div>HSN</div>
            <div>Qty</div>
            {dt.taxable
              ? <><div>Rate</div><div>GST%</div><div>Disc</div><div className="text-right">Total</div></>
              : <><div>Unit</div></>}
            <div />
          </div>
          {items.map((it, i) => (
            <div key={i} className={`grid gap-2 items-start ${
              dt.taxable
                ? "grid-cols-[2fr_1fr_0.6fr_1fr_0.8fr_0.8fr_1fr_2.4rem]"
                : "grid-cols-[3fr_1fr_0.7fr_1fr_2.4rem]"
            }`}>
              <div className="space-y-1">
                <Select value={it.inventoryId} onChange={(e) => pickInventory(i, e.target.value)}>
                  <option value="">— from inventory —</option>
                  {inventory.map((x) => <option key={x.id} value={x.id}>{x.name} (stock: {x.quantity})</option>)}
                </Select>
                <Input placeholder="Item name" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
              </div>
              <Input value={it.hsnCode} onChange={(e) => setItem(i, { hsnCode: e.target.value })} />
              <Input type="number" min={0} step="0.01" value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} />
              {dt.taxable ? (
                <>
                  <Input type="number" min={0} step="0.01" value={it.sellingPrice} onChange={(e) => setItem(i, { sellingPrice: Number(e.target.value) })} />
                  <Select value={it.gstRate} onChange={(e) => setItem(i, { gstRate: Number(e.target.value) })}>
                    {GST_SLABS.map((r) => <option key={r} value={r}>{r}%</option>)}
                  </Select>
                  <Input type="number" min={0} step="0.01" value={it.discount} onChange={(e) => setItem(i, { discount: Number(e.target.value) })} />
                  <div className="text-right pt-2 text-sm">{formatINR(computed.items[i]?.total || 0)}</div>
                </>
              ) : (
                <Input value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} placeholder="PCS" />
              )}
              <Button variant="ghost" size="icon" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog
        open={boqDialog}
        onClose={() => setBoqDialog(false)}
        title={`Bill from BOQ — ${selectedProject?.name || ""}`}
        size="lg"
        footer={<>
          <Button variant="outline" onClick={() => setBoqDialog(false)}>Cancel</Button>
          <Button onClick={() => {
            const picked = (selectedProject?.boqItems || [])
              .map((it, i) => ({ it, p: boqPicks[i] }))
              .filter(({ p }) => p && p.picked && Number(p.qty) > 0)
              .map(({ it, p }) => ({
                inventoryId: "",
                name: it.name,
                hsnCode: it.hsnCode || "",
                quantity: Number(p.qty),
                sellingPrice: Number(it.rate) || 0,
                gstRate: Number(it.gstRate) || 0,
                discount: 0,
                unit: it.unit || "PCS"
              }));
            if (picked.length === 0) {
              toast({ type: "error", title: "Tick at least one item with a quantity > 0" });
              return;
            }
            // Replace blank starter row, otherwise append
            setItems((arr) => {
              const onlyBlank = arr.length === 1 && !arr[0].name && !arr[0].quantity && !arr[0].sellingPrice;
              return onlyBlank ? picked : [...arr, ...picked];
            });
            setBoqDialog(false);
          }}>Add to invoice</Button>
        </>}
      >
        {selectedProject ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Tick the BOQ rows you want to bill. You can change the quantity if you're billing a partial milestone.
            </p>
            <div className="grid grid-cols-[2.5rem_2.5fr_0.7fr_1fr_0.8fr_1fr] gap-2 text-xs text-muted-foreground px-1 pb-1 border-b">
              <div></div>
              <div>Scope</div>
              <div>Unit</div>
              <div className="text-right">Bill qty</div>
              <div className="text-right">Rate</div>
              <div className="text-right">Amount</div>
            </div>
            {(selectedProject.boqItems || []).map((it, i) => {
              const pick = boqPicks[i] || { picked: false, qty: it.quantity };
              const amt = (Number(pick.qty) || 0) * (Number(it.rate) || 0);
              return (
                <div key={i} className="grid grid-cols-[2.5rem_2.5fr_0.7fr_1fr_0.8fr_1fr] gap-2 items-center py-1.5 border-b last:border-0">
                  <input type="checkbox" checked={!!pick.picked} onChange={(e) => setBoqPicks((s) => ({ ...s, [i]: { ...pick, picked: e.target.checked } }))} />
                  <div>
                    <div className="text-sm font-medium">{it.name}</div>
                    {it.description ? <div className="text-xs text-muted-foreground">{it.description}</div> : null}
                    <div className="text-[10px] text-muted-foreground">BOQ qty {it.quantity}</div>
                  </div>
                  <div className="text-sm">{it.unit || "—"}</div>
                  <Input type="number" min={0} step="0.01" value={pick.qty} onChange={(e) => setBoqPicks((s) => ({ ...s, [i]: { ...pick, qty: Number(e.target.value) } }))} />
                  <div className="text-right text-sm">{formatINR(it.rate)}</div>
                  <div className="text-right text-sm font-medium">{formatINR(amt)}</div>
                </div>
              );
            })}
          </div>
        ) : null}
      </Dialog>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={`Visible on the ${docType.toLowerCase()}.`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Document-level discount (₹)">
              <Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            </Field>
            {dt.affectsOutstanding ? (
              <Field label="Amount received (₹)">
                <Input type="number" min={0} step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(Number(e.target.value))} />
              </Field>
            ) : (
              <p className="text-xs text-muted-foreground">
                {dt.value} doesn't track payments — convert to a Tax Invoice when goods/services are delivered.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
