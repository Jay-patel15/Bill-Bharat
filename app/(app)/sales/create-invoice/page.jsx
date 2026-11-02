"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";
import { computeInvoice, gstStateFromGstin, GST_SLABS, GST_UNITS } from "@/lib/gst";
import { formatINR, nextInvoiceNumber, DEFAULT_NUMBER_FORMAT, DOCUMENT_TYPES, getDocumentType, formatInvoiceNotes, STATES, localDate } from "@/lib/utils";
import { NoCompanySelected } from "@/components/empty-state";
import { ItemSearch } from "@/components/item-search";
import { MASTER_CREATED } from "@/components/quick-create";

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
  const [allSales, setAllSales] = useState([]);
  const [customerId, setCustomerId] = useState(search.get("customer") || "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [items, setItems] = useState([blankItem()]);
  const [invoiceDate, setInvoiceDate] = useState(localDate());
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [numberDirty, setNumberDirty] = useState(false);
  const [numberFormat, setNumberFormat] = useState(DEFAULT_NUMBER_FORMAT);
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
    api("/api/sales").then(setAllSales).catch(() => setAllSales([]));
    api("/api/settings/invoice-template").then((r) => setNumberFormat(r.template.text.numberFormat)).catch(() => {});
  }, [active?.id]);

  // Alt+C quick create: add the new customer/item to the lists (and select a new customer).
  useEffect(() => {
    const added = (e) => {
      const { kind, record } = e.detail;
      if (kind === "customer") { setCustomers((l) => [...l, record]); setCustomerId(record.id); }
      else setInventory((l) => [...l, record]);
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
    const c = computeInvoice({ items, supplierStateCode, recipientStateCode, invoiceDiscount: Number(discount) || 0, roundToRupee: dt.taxable });
    if (!dt.taxable) {
      for (const it of c.items) { it.cgst = it.sgst = it.igst = 0; it.total = it.taxable; }
      c.cgst = c.sgst = c.igst = 0;
      c.grandTotal = c.subtotal;
    }
    return c;
  }, [items, supplierStateCode, recipientStateCode, discount, dt.taxable]);

  function setItem(i, patch) { setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it)); }
  function pickInventory(i, inv) {
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
    setInvoiceNumber(nextInvoiceNumber(allSales.map((s) => s.invoiceNumber), dt.prefix, numberFormat, invoiceDate));
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
          customerId,
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
        <div>
          <h1 className="text-2xl font-semibold">New {docType}</h1>
          <p className="text-sm text-muted-foreground">
            Previous {docType.toLowerCase()} no.: <span className="font-mono text-foreground">{previousNumber || "none yet"}</span>
            {" · "}This one: <span className="font-mono text-foreground">{invoiceNumber || "—"}</span>
          </p>
        </div>
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

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Document details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label={`${docType} number *`} hint="Auto-numbered; ↻ restores the next number">
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
          <Button data-add-row size="sm" variant="outline" onClick={() => setItems((a) => [...a, blankItem()])}>
            <Plus className="h-3.5 w-3.5" /> Add row
          </Button>
        </CardHeader>
        <CardContent className="space-y-2" data-grid>
          <datalist id="gst-unit-list">
            {GST_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <div className={`grid gap-2 [&>*]:min-w-0 text-xs text-muted-foreground px-2 ${
            dt.taxable
              ? "grid-cols-[3.2fr_0.9fr_0.6fr_0.7fr_0.9fr_0.7fr_0.7fr_1fr_2.4rem]"
              : "grid-cols-[4fr_1fr_0.6fr_0.8fr_2.4rem]"
          }`}>
            <div>Item</div>
            <div>HSN</div>
            <div>Qty</div>
            <div>Unit</div>
            {dt.taxable && (
              <><div>Rate</div><div>GST%</div><div>Disc</div><div className="text-right">Total</div></>
            )}
            <div />
          </div>
          {items.map((it, i) => (
            <div key={i} data-grid-row className={`grid gap-2 items-start [&>*]:min-w-0 ${
              dt.taxable
                ? "grid-cols-[3.2fr_0.9fr_0.6fr_0.7fr_0.9fr_0.7fr_0.7fr_1fr_2.4rem]"
                : "grid-cols-[4fr_1fr_0.6fr_0.8fr_2.4rem]"
            }`}>
              <ItemSearch
                value={it.name}
                items={inventory}
                onText={(name) => setItem(i, { name, inventoryId: "" })}
                onPick={(inv) => pickInventory(i, inv)}
              />
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
                  <Select value={it.gstRate} onChange={(e) => setItem(i, { gstRate: Number(e.target.value) })}>
                    {GST_SLABS.map((r) => <option key={r} value={r}>{r}%</option>)}
                  </Select>
                  <Input type="number" min={0} step="0.01" value={it.discount} onChange={(e) => setItem(i, { discount: Number(e.target.value) })} />
                  <div className="text-right pt-2 text-sm">{formatINR(computed.items[i]?.total || 0)}</div>
                </>
              )}
              <Button variant="ghost" size="icon" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
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
        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {computed.invoiceDiscount > 0 && (<>
              <Row label="Gross value" value={formatINR(computed.gross)} />
              <Row label="Less: discount" value={"- " + formatINR(computed.invoiceDiscount)} />
            </>)}
            <Row label="Taxable value" value={formatINR(computed.subtotal)} />
            {dt.taxable && (computed.interstate
              ? <Row label="IGST" value={formatINR(computed.igst)} />
              : (<><Row label="CGST" value={formatINR(computed.cgst)} /><Row label="SGST" value={formatINR(computed.sgst)} /></>))}
            {dt.taxable && computed.roundOff !== 0 && <Row label="Round off" value={formatINR(computed.roundOff)} />}
            <div className="border-t pt-2">
              <Row label={<strong>Grand Total</strong>} value={<strong>{formatINR(computed.grandTotal)}</strong>} />
            </div>
            <div className="text-[11px] text-muted-foreground pt-1">
              {!dt.taxable
                ? "Non-taxable document — no GST applied."
                : (computed.interstate ? "Interstate (IGST)" : "Intrastate (CGST + SGST)")}
            </div>
            <Button data-accept className="w-full mt-3" onClick={save} disabled={saving}>{saving ? "Saving…" : `Save ${docType}`}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
