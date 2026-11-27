"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";
import { computeInvoice, gstStateFromGstin, GST_SLABS, GST_UNITS, isGstCompany } from "@/lib/gst";
import { formatINR, nextInvoiceNumber, DEFAULT_NUMBER_FORMAT, DOCUMENT_TYPES, getDocumentType, formatInvoiceNotes, parseInvoiceNotes, STATES, localDate } from "@/lib/utils";
import { NoCompanySelected } from "@/components/empty-state";
import { ItemSearch } from "@/components/item-search";
import { MASTER_CREATED, OPEN_QUICK_CREATE } from "@/components/quick-create";
import { navReplace } from "@/components/back-handler";
import { PdfPreview } from "@/components/pdf-preview";

const blankItem = () => ({
  inventoryId: "", name: "", hsnCode: "", quantity: 1,
  sellingPrice: 0, gstRate: 18, discount: 0, unit: "PCS"
});

const blankTransport = {
  challanNumber: "", challanDate: "", orderNumber: "", orderDate: "", lrNumber: "", lrDate: "",
  transporter: "", ewayNumber: "", paymentTerms: "", validTill: "", consigneeSameAsBuyer: true, consigneeName: "",
  consigneeAddress: "", consigneeGst: "", consigneePhone: "", consigneeState: "", consigneeStateCode: ""
};

const NEW_CUSTOMER = "__new_customer__"; // dropdown option that opens the customer form

export default function CreateInvoicePage() {
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();
  const { active } = useCompany();
  const gstOn = isGstCompany(active); // no GSTIN on the company: bill without GST
  const [showCost, setShowCost] = useState(false); // on-screen only: purchase rate and margin, never printed
  // ?edit=<saleId> opens an existing document: same form, saved with PUT. Number and customer stay fixed.
  const editId = search.get("edit") || "";
  // ?convertFrom=<quotationId> starts a Tax Invoice from that quotation; saving marks the quotation Converted.
  const convertFrom = search.get("convertFrom") || "";

  const [docType, setDocType] = useState(search.get("type") || "Tax Invoice");
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [customerId, setCustomerId] = useState(search.get("customer") || "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [items, setItems] = useState([blankItem()]);
  const [invoiceDate, setInvoiceDate] = useState(localDate());
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [excessOk, setExcessOk] = useState(false); // user chose to keep an amount above the total
  const paidInput = useRef(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [consumableLine, setConsumableLine] = useState(null); // item index whose consumables popup is open
  const [draft, setDraft] = useState([]);
  const [numberDirty, setNumberDirty] = useState(false);
  const [numberFormat, setNumberFormat] = useState(DEFAULT_NUMBER_FORMAT);
  const [showTransport, setShowTransport] = useState(false);
  const [transport, setTransport] = useState(blankTransport);
  const [previewing, setPreviewing] = useState(false);
  const [pdfPreview, setPdfPreview] = useState(null); // { src, name } of the draft's PDF while open
  const [askItem, setAskItem] = useState(null); // typed item not in stock: { name, hsnCode, unit, sellingPrice, gstRate }
  const declinedItems = useRef(new Set()); // names the user answered "No" to, so we do not ask again

  useEffect(() => {
    if (!active?.id) return;
    api("/api/customers").then(setCustomers).catch(() => setCustomers([]));
    api("/api/inventory").then(setInventory).catch(() => setInventory([]));
    api("/api/sales").then(setAllSales).catch(() => setAllSales([]));
    api("/api/settings/invoice-template").then((r) => setNumberFormat(r.template.text.numberFormat)).catch(() => {});
  }, [active?.id]);

  // Edit mode: fill the form from the saved document. Its notes hold the transport details as metadata.
  useEffect(() => {
    if (!editId || !active?.id) return;
    api(`/api/sales/${editId}`).then((s) => {
      if (getDocumentType(s.documentType).affectsOutstanding && Number(s.amountPaid) > 0) {
        throw new Error("This invoice has payments. Only unpaid invoices can be edited");
      }
      const { notes: plain, metadata } = parseInvoiceNotes(s.notes || "");
      setDocType(s.documentType || "Tax Invoice");
      setCustomerId(s.customerId || "");
      setNumberDirty(true);
      setInvoiceNumber(s.invoiceNumber || "");
      setInvoiceDate(s.invoiceDate || localDate());
      setDueDate(s.dueDate || "");
      setItems(s.items?.length ? s.items : [blankItem()]);
      setDiscount(Number(s.discount) || 0);
      setNotes(plain);
      setTransport({ ...blankTransport, ...metadata });
    }).catch((e) => {
      toast({ type: "error", title: "Could not open invoice", message: e.message });
      navReplace(router, "/sales");
    });
  }, [editId, active?.id]);

  // Convert a quotation: fill this new Tax Invoice from it. The number and date are new.
  useEffect(() => {
    if (!convertFrom || !active?.id) return;
    api(`/api/sales/${convertFrom}`).then((q) => {
      if (q.documentType !== "Quotation" || q.status === "Converted") throw new Error("This quotation cannot be converted");
      const { notes: plain, metadata } = parseInvoiceNotes(q.notes || "");
      setDocType("Tax Invoice");
      setCustomerId(q.customerId || "");
      setItems(q.items?.length ? q.items : [blankItem()]);
      setDiscount(Number(q.discount) || 0);
      setNotes(plain);
      setTransport({ ...blankTransport, ...metadata });
    }).catch((e) => {
      toast({ type: "error", title: "Could not convert", message: e.message });
      navReplace(router, "/sales");
    });
  }, [convertFrom, active?.id]);

  // Alt+C quick create: add the new customer/item to the lists (and select a new customer).
  useEffect(() => {
    const added = (e) => {
      const { kind, record } = e.detail;
      if (kind === "customer") { setCustomers((l) => [...l, record]); setCustomerId(record.id); }
      else {
        setInventory((l) => [...l, record]);
        // Link the invoice row that asked for this item, so its stock is tracked.
        setItems((arr) => arr.map((it) => !it.inventoryId && it.name?.trim().toLowerCase() === record.name?.trim().toLowerCase()
          ? { ...it, inventoryId: record.id, name: record.name, hsnCode: record.hsnCode || "", sellingPrice: Number(record.sellingPrice) || 0, gstRate: Number(record.gstRate) || 0, unit: record.unit || "PCS", consumablesUsed: [] }
          : it));
      }
    };
    window.addEventListener(MASTER_CREATED, added);
    return () => window.removeEventListener(MASTER_CREATED, added);
  }, []);

  // Auto-suggest the next number whenever doc type or sales list changes
  // (but don't overwrite if the user has edited it).
  useEffect(() => {
    if (numberDirty) return;
    const dt = getDocumentType(docType);
    setInvoiceNumber(nextInvoiceNumber(allSales.map((s) => s.invoiceNumber), dt.prefix, numberFormat, invoiceDate));
  }, [docType, allSales, numberDirty, numberFormat, invoiceDate]);

  const dt = getDocumentType(docType);
  // allSales is newest first, so the first match is the last number issued for this document type.
  const previousNumber = allSales.find((s) => (s.documentType || "Tax Invoice") === docType)?.invoiceNumber || "";
  const customer = customers.find((c) => c.id === customerId);
  const supplierStateCode = active?.stateCode || gstStateFromGstin(active?.gstNumber || "");
  const recipientStateCode = customer?.stateCode || gstStateFromGstin(customer?.gstNumber || "") || supplierStateCode;

  const computed = useMemo(() => {
    // Same rule as the server: without a GSTIN every line is priced at 0% GST.
    const priced = gstOn ? items : items.map((it) => ({ ...it, gstRate: 0 }));
    const c = computeInvoice({ items: priced, supplierStateCode, recipientStateCode, invoiceDiscount: Number(discount) || 0, roundToRupee: dt.taxable });
    if (!dt.taxable) {
      for (const it of c.items) { it.cgst = it.sgst = it.igst = 0; it.total = it.taxable; }
      c.cgst = c.sgst = c.igst = 0;
      c.grandTotal = c.subtotal;
    }
    return c;
  }, [items, supplierStateCode, recipientStateCode, discount, dt.taxable, gstOn]);

  const overPaid = dt.affectsOutstanding && !editId && Number(amountPaid) > computed.grandTotal + 0.001 && !excessOk;

  // Typing or picking a name in the last row also opens a blank row under it (auto add row).
  function setItem(i, patch) {
    setItems((arr) => {
      const next = arr.map((it, idx) => idx === i ? { ...it, ...patch } : it);
      return i === arr.length - 1 && patch.name?.trim() ? [...next, blankItem()] : next;
    });
  }
  function insertRow(at) { setItems((arr) => [...arr.slice(0, at), blankItem(), ...arr.slice(at)]); }
  function pickInventory(i, inv) {
    setItem(i, {
      inventoryId: inv.id,
      name: inv.name,
      hsnCode: inv.hsnCode || "",
      sellingPrice: Number(inv.sellingPrice) || 0,
      gstRate: Number(inv.gstRate) || 0,
      unit: inv.unit || "PCS",
      consumablesUsed: []
    });
    if (Number(inv.consumables) && docType === "Tax Invoice") openConsumables(i, []);
  }

  // Typed item name that is not in inventory (and not already declined): ask whether to add it.
  function checkNewItem(i) {
    const it = items[i];
    const name = it?.name?.trim();
    if (!name || it.inventoryId || declinedItems.current.has(name.toLowerCase())) return;
    const key = name.toLowerCase();
    if (inventory.some((x) => [x.name, x.sku, x.barcode].some((v) => v?.trim().toLowerCase() === key))) return;
    setAskItem({ name, hsnCode: it.hsnCode || "", unit: it.unit || "PCS", sellingPrice: it.sellingPrice || "", gstRate: it.gstRate ?? 18 });
  }
  function declineAskedItem() { declinedItems.current.add(askItem.name.toLowerCase()); setAskItem(null); }
  function addAskedItem() {
    const { name, hsnCode, unit, sellingPrice, gstRate } = askItem;
    setAskItem(null);
    window.dispatchEvent(new CustomEvent(OPEN_QUICK_CREATE, { detail: { kind: "item", prefill: { name, hsnCode, unit, sellingPrice: String(sellingPrice), gstRate } } }));
  }

  // Stock items only: the Electrical Works line itself is not a part.
  const stockItems = inventory.filter((x) => !Number(x.consumables));
  // A line whose item was removed still shows its parts so they can be edited.
  const isConsumablesLine = (it) => {
    const row = inventory.find((x) => x.id === it.inventoryId);
    return row ? Number(row.consumables) > 0 : (it.consumablesUsed || []).length > 0;
  };
  const blankPart = () => ({ inventoryId: "", name: "", unit: "", quantity: 1 });

  function openConsumables(i, parts) {
    setDraft(parts.length ? parts.map((p) => ({ ...p })) : [blankPart()]);
    setConsumableLine(i);
  }
  function setDraftRow(r, patch) { setDraft((d) => d.map((p, idx) => idx === r ? { ...p, ...patch } : p)); }
  function saveConsumables() {
    if (draft.some((p) => p.name && !p.inventoryId)) return toast({ type: "error", title: "Pick each part from the stock list" });
    if (draft.some((p) => p.inventoryId && !(Number(p.quantity) > 0))) return toast({ type: "error", title: "Quantity must be more than zero" });
    const used = draft.filter((p) => p.inventoryId)
      .map(({ inventoryId, name, unit, quantity }) => ({ inventoryId, name, unit, quantity: Number(quantity) }));
    setItem(consumableLine, { consumablesUsed: used });
    setConsumableLine(null);
  }
  function regenerateNumber() {
    setNumberDirty(false);
    setInvoiceNumber(nextInvoiceNumber(allSales.map((s) => s.invoiceNumber), dt.prefix, numberFormat, invoiceDate));
  }

  /** Builds the PDF of the bill as it is now, for checking. Nothing is saved. */
  async function previewDraft() {
    const named = items.filter((i) => i.name);
    if (!customerId || named.length === 0) return toast({ type: "error", title: "Pick a customer and add an item to preview" });
    setPreviewing(true);
    try {
      const res = await fetch("/api/sales/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyId: active.id,
          customerId,
          documentType: docType,
          invoiceNumber: invoiceNumber.trim(),
          invoiceDate,
          dueDate,
          items: named.map((it) => ({ ...it, consumablesUsed: docType === "Tax Invoice" ? it.consumablesUsed || [] : [] })),
          discount: Number(discount) || 0,
          notes: formatInvoiceNotes(notes, transport)
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || j.message || "Could not build the preview");
      }
      const url = URL.createObjectURL(await res.blob());
      setPdfPreview({ src: url, name: `${invoiceNumber || "preview"}.pdf` });
    } catch (e) {
      toast({ type: "error", title: "Could not preview", message: e.message });
    } finally { setPreviewing(false); }
  }

  function closePreview() {
    if (pdfPreview?.src) URL.revokeObjectURL(pdfPreview.src);
    setPdfPreview(null);
  }

  async function save() {
    if (!customerId) return toast({ type: "error", title: "Pick a customer" });
    // Rows with no item name (the blank row auto-add leaves at the bottom) are not saved.
    const named = items.filter((i) => i.name);
    if (named.length === 0) return toast({ type: "error", title: "Add at least one named item" });
    if (overPaid) return toast({ type: "error", title: "Amount received is more than the total", message: "Re-edit it, or choose Ignore and save anyway." });
    setSaving(true);
    try {
      // Consumables are issued on a Tax Invoice only; other documents carry none.
      const lines = named.map((it) => ({ ...it, consumablesUsed: docType === "Tax Invoice" ? it.consumablesUsed || [] : [] }));
      const common = { invoiceDate, dueDate, items: lines, discount: Number(discount) || 0, notes: formatInvoiceNotes(notes, transport) };
      const saved = editId
        ? await api(`/api/sales/${editId}`, { method: "PUT", body: JSON.stringify(common) })
        : await api("/api/sales", {
          method: "POST",
          body: JSON.stringify({
            ...common,
            documentType: docType,
            invoiceNumber: invoiceNumber.trim(),
            customerId,
            amountPaid: Number(amountPaid) || 0,
            convertFromId: convertFrom || null
          })
        });
      toast({ type: "success", title: editId ? `${docType} updated` : `${docType} created`, message: saved.invoiceNumber });
      navReplace(router, `/sales/${saved.id}`);
    } catch (e) {
      toast({ type: "error", title: "Could not save", message: e.message });
    } finally { setSaving(false); }
  }

  if (!active) return <NoCompanySelected />;

  const itemCols = !dt.taxable
    ? "grid-cols-[4fr_1fr_0.6fr_0.8fr_2.4rem]"
    : gstOn
      ? "grid-cols-[3.2fr_0.9fr_0.6fr_0.7fr_0.9fr_0.7fr_0.7fr_1fr_2.4rem]"
      : "grid-cols-[3.2fr_0.9fr_0.6fr_0.7fr_0.9fr_0.7fr_1fr_2.4rem]";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{editId ? `Edit ${docType}` : `New ${docType}`}</h1>
          <p className="text-sm text-muted-foreground">
            Previous {docType.toLowerCase()} no.: <span className="font-mono text-foreground">{previousNumber || "none yet"}</span>
            {" · "}This one: <span className="font-mono text-foreground">{invoiceNumber || "—"}</span>
          </p>
        </div>
      </div>

      {/* Doc-type pill bar: the open document's type stays highlighted; the type cannot change while editing */}
      <div className="flex flex-wrap gap-2">
        {DOCUMENT_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            disabled={!!editId}
            onClick={() => setDocType(t.value)}
            aria-pressed={docType === t.value}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors disabled:cursor-not-allowed ${
              docType === t.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-accent disabled:hover:bg-background"
            } ${editId && docType !== t.value ? "opacity-50" : ""}`}
          >
            {t.value}
            <span className="ml-2 text-[10px] opacity-70">{t.prefix}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Document details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label={`${docType} number *`} hint="Auto-numbered; ↻ restores the next number">
              <div className="flex gap-2">
                <Input disabled={!!editId} value={invoiceNumber} onChange={(e) => { setInvoiceNumber(e.target.value); setNumberDirty(true); }} />
                {!editId && (
                  <Button type="button" variant="outline" size="icon" onClick={regenerateNumber} title="Auto-generate">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Field>
            <Field label="Customer *">
              <Select disabled={!!editId} value={customerId} onChange={(e) => e.target.value === NEW_CUSTOMER
                ? window.dispatchEvent(new CustomEvent(OPEN_QUICK_CREATE, { detail: { kind: "customer" } }))
                : setCustomerId(e.target.value)}>
                <option value="">Select customer…</option>
                <option value={NEW_CUSTOMER}>+ Add new customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.gstNumber ? ` · ${c.gstNumber}` : ""}</option>)}
              </Select>
            </Field>
            <Field label="Date"><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></Field>
            <Field label={dt.value === "Purchase Order" ? "Expected delivery" : "Due date"}>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            {dt.value === "Quotation" && (
              <Field label="Valid till" hint="Printed on the quotation as a note: “This quotation is valid till …”">
                <Input type="date" value={transport.validTill} onChange={(e) => setTransport({ ...transport, validTill: e.target.value })} />
              </Field>
            )}
          </CardContent>
        </Card>

        <Card>
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

      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Items</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowCost((s) => !s)}>
              {showCost ? "Hide purchase rate" : "Show purchase rate"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2" data-grid>
          <datalist id="gst-unit-list">
            {GST_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <div className={`grid gap-2 [&>*]:min-w-0 text-xs text-muted-foreground px-2 ${itemCols}`}>
            <div>Item</div>
            <div>HSN</div>
            <div>Qty</div>
            <div>Unit</div>
            {dt.taxable && (
              <><div>Rate</div>{gstOn && <div>GST%</div>}<div>Disc</div><div className="text-right">Total</div></>
            )}
            <div />
          </div>
          {items.map((it, i) => (
            <div key={i} data-grid-row className={`grid gap-2 items-start [&>*]:min-w-0 ${itemCols}`}>
              <div className="min-w-0">
                <ItemSearch
                  value={it.name}
                  items={inventory.filter((x) => Number(x.consumables) !== 2)}
                  onText={(name) => setItem(i, { name, inventoryId: "", consumablesUsed: [] })}
                  onPick={(inv) => pickInventory(i, inv)}
                  onBlur={() => checkNewItem(i)}
                />
                {showCost && (() => {
                  // Linked item, or else a stock item whose name / SKU matches the typed text (typing clears the link).
                  const typed = (it.name || "").trim().toLowerCase();
                  const stock = inventory.find((x) => x.id === it.inventoryId)
                    || (typed && inventory.find((x) => x.name?.trim().toLowerCase() === typed || (x.sku && x.sku.trim().toLowerCase() === typed)));
                  if (!stock) return <div className="mt-1 text-[11px] text-muted-foreground">Purchase rate: not a stock item</div>;
                  const buy = Number(stock.purchasePrice) || 0;
                  const sell = Number(it.sellingPrice) || 0;
                  return (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Purchase rate {buy > 0 ? formatINR(buy) : "not recorded"}
                      {buy > 0 ? ` · margin ${(((sell - buy) / buy) * 100).toFixed(1)}%` : ""}
                      <span className="text-amber-700"> (preview only, not printed)</span>
                    </div>
                  );
                })()}
                {isConsumablesLine(it) && docType === "Tax Invoice" && (
                  <button type="button" onClick={() => openConsumables(i, it.consumablesUsed || [])} className="mt-1 text-xs text-primary hover:underline">
                    Consumables: {(it.consumablesUsed || []).length} part(s) · edit
                  </button>
                )}
              </div>
              <Input value={it.hsnCode} onChange={(e) => setItem(i, { hsnCode: e.target.value })} />
              <Input type="number" min={0} step="0.01" value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} />
              <Input
                list="gst-unit-list"
                placeholder="Unit"
                value={it.unit ?? ""}
                onChange={(e) => setItem(i, { unit: e.target.value.toUpperCase() })}
              />
              {dt.taxable && (
                <>
                  <Input type="number" min={0} step="0.01" value={it.sellingPrice} onChange={(e) => setItem(i, { sellingPrice: Number(e.target.value) })} />
                  {gstOn && (
                    <Select value={it.gstRate} onChange={(e) => setItem(i, { gstRate: Number(e.target.value) })}>
                      {GST_SLABS.map((r) => <option key={r} value={r}>{r}%</option>)}
                    </Select>
                  )}
                  <Input type="number" min={0} step="0.01" value={it.discount} onChange={(e) => setItem(i, { discount: Number(e.target.value) })} />
                  <div className="text-right pt-2 text-sm">{formatINR(computed.items[i]?.total || 0)}</div>
                </>
              )}
              <div className="flex">
                <Button variant="ghost" size="icon" className="h-8 w-7" title="Insert row above" onClick={() => insertRow(i)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-7" title="Insert row below" onClick={() => insertRow(i + 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-7" title="Delete row" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3 items-start">
        <div className="space-y-4 lg:col-span-2">
        <Card>
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
            {editId && dt.affectsOutstanding ? (
              <p className="text-xs text-muted-foreground">Payments are recorded on the invoice page, not here.</p>
            ) : dt.affectsOutstanding ? (
              <>
              <Field label="Amount received (₹)">
                <Input ref={paidInput} type="number" min={0} step="0.01" value={amountPaid}
                  onChange={(e) => { setAmountPaid(Number(e.target.value)); setExcessOk(false); }} />
              </Field>
              {overPaid && (
                <div className="text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded p-3 space-y-2">
                  <div>⚠️ <strong>{formatINR(amountPaid)}</strong> is more than the bill total <strong>{formatINR(computed.grandTotal)}</strong>. Re-edit the amount, or ignore and save it as it is.</div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { paidInput.current?.focus(); paidInput.current?.select(); }}>Re-edit amount</Button>
                    <Button size="sm" variant="outline" onClick={() => setExcessOk(true)}>Ignore and save anyway</Button>
                  </div>
                </div>
              )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {dt.value} doesn't track payments — convert to a Tax Invoice when goods/services are delivered.
              </p>
            )}
          </CardContent>
        </Card>
        </div>
        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {computed.invoiceDiscount > 0 && (<>
              <Row label="Gross value" value={formatINR(computed.gross)} />
              <Row label="Less: discount" value={"- " + formatINR(computed.invoiceDiscount)} />
            </>)}
            <Row label="Taxable value" value={formatINR(computed.subtotal)} />
            {dt.taxable && gstOn && (computed.interstate
              ? <Row label="IGST" value={formatINR(computed.igst)} />
              : (<><Row label="CGST" value={formatINR(computed.cgst)} /><Row label="SGST" value={formatINR(computed.sgst)} /></>))}
            {dt.taxable && computed.roundOff !== 0 && <Row label="Round off" value={formatINR(computed.roundOff)} />}
            <div className="border-t pt-2">
              <Row label={<strong>Grand Total</strong>} value={<strong>{formatINR(computed.grandTotal)}</strong>} />
            </div>
            <div className="text-[11px] text-muted-foreground pt-1">
              {!dt.taxable
                ? "Non-taxable document — no GST applied."
                : !gstOn
                  ? "No GST: add the company GSTIN in Company settings to bill with GST."
                  : (computed.interstate ? "Interstate (IGST)" : "Intrastate (CGST + SGST)")}
            </div>
            <Button type="button" variant="outline" className="w-full mt-3" onClick={previewDraft} disabled={previewing || saving}>
              {previewing ? "Building preview…" : `Preview ${docType.toLowerCase()}`}
            </Button>
            <Button data-accept className="w-full mt-3" onClick={save} disabled={saving || overPaid}>{saving ? "Saving…" : `Save ${docType}`}</Button>
          </CardContent>
        </Card>
      </div>

      <PdfPreview src={pdfPreview?.src} fileName={pdfPreview?.name} onClose={closePreview} />
      <Dialog open={!!askItem} onClose={declineAskedItem} title="Add to inventory?" size="sm"
        footer={<><Button variant="outline" onClick={declineAskedItem}>No</Button><Button onClick={addAskedItem}>Yes, add item</Button></>}>
        <p className="text-sm">&ldquo;{askItem?.name}&rdquo; is not in your inventory. Add it now? The form opens with these details filled in.</p>
      </Dialog>
      <Dialog open={consumableLine !== null} onClose={() => setConsumableLine(null)} title="Consumables used on Electrical Works" size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setConsumableLine(null)}>Cancel</Button>
            <Button onClick={saveConsumables}>Done</Button>
          </>
        }>
        <p className="text-xs text-muted-foreground mb-3">
          Parts used on this work are issued from stock. They are not printed on the invoice; the Electrical Works line is what the customer sees.
        </p>
        <div className="space-y-2">
          <div className="grid grid-cols-[3fr_0.9fr_0.7fr_2.4rem] gap-2 text-xs text-muted-foreground px-1">
            <div>Part</div><div>Qty</div><div>Unit</div><div />
          </div>
          {draft.map((p, r) => {
            const inStock = stockItems.find((x) => x.id === p.inventoryId);
            const short = inStock && Number(p.quantity) > Number(inStock.quantity);
            return (
              <div key={r} className="grid grid-cols-[3fr_0.9fr_0.7fr_2.4rem] gap-2 items-start">
                <div className="min-w-0">
                  <ItemSearch
                    value={p.name}
                    items={stockItems}
                    placeholder="Search part…"
                    onText={(name) => setDraftRow(r, { name, inventoryId: "", unit: "" })}
                    onPick={(inv) => setDraftRow(r, { inventoryId: inv.id, name: inv.name, unit: inv.unit || "PCS" })}
                  />
                  {inStock && (
                    <div className={`text-[11px] mt-1 ${short ? "text-amber-600" : "text-muted-foreground"}`}>
                      In stock: {inStock.quantity} {inStock.unit || "PCS"}{short ? " — stock will go negative" : ""}
                    </div>
                  )}
                </div>
                <Input type="number" min={0} step="0.01" value={p.quantity} onChange={(e) => setDraftRow(r, { quantity: Number(e.target.value) })} />
                <div className="pt-2 text-sm">{p.unit}</div>
                <Button variant="ghost" size="icon" onClick={() => setDraft((d) => d.filter((_, idx) => idx !== r))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setDraft((d) => [...d, blankPart()])}>
          <Plus className="h-3.5 w-3.5" /> Add part
        </Button>
      </Dialog>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
