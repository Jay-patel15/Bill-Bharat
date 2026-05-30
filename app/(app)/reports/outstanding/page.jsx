"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, FileDown, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api, useCompany } from "@/components/company-context";
import { formatINR, formatDate, diffDays } from "@/lib/utils";
import { NoCompanySelected } from "@/components/empty-state";

export default function OutstandingDuesReportPage() {
  const { active } = useCompany();
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active?.id) { setLoading(false); return; }
    setLoading(true); setError("");
    
    Promise.all([
      api("/api/sales"),
      api("/api/customers")
    ])
      .then(([s, c]) => {
        setSales(s || []);
        setCustomers(c || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || "Failed to load outstanding data");
        setLoading(false);
      });
  }, [active?.id]);

  const reportData = useMemo(() => {
    if (!sales.length || !customers.length) return { customersOutstanding: [], totalAmount: 0, totalCustomers: 0 };

    // Group sales by customer
    const grouped = {};
    let grandTotal = 0;

    // Filter to only Tax Invoices that have a pending balance
    const outstandingSales = sales.filter(
      (s) => (s.documentType || "Tax Invoice") === "Tax Invoice" && Number(s.total) - Number(s.amountPaid) > 0
    );

    outstandingSales.forEach((s) => {
      const custId = s.customerId;
      if (!custId) return;

      if (!grouped[custId]) {
        const c = customers.find((cust) => cust.id === custId);
        grouped[custId] = {
          id: custId,
          name: c ? c.name : "Unknown Customer",
          rows: [],
          totalPending: 0
        };
      }

      const pendingAmount = Number(s.total) - Number(s.amountPaid);
      const dueOn = s.dueDate || s.invoiceDate;
      const overdueDays = diffDays(dueOn);

      grouped[custId].rows.push({
        date: s.invoiceDate,
        refNo: s.invoiceNumber,
        pendingAmount,
        dueOn,
        overdueDays: overdueDays > 0 && new Date() > new Date(dueOn) ? overdueDays : 0
      });

      grouped[custId].totalPending += pendingAmount;
      grandTotal += pendingAmount;
    });

    // Convert grouped object to array and sort by customer name
    const list = Object.values(grouped)
      .filter((c) => c.totalPending > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      customersOutstanding: list,
      totalAmount: grandTotal,
      totalCustomers: list.length
    };
  }, [sales, customers]);

  if (!active) return <NoCompanySelected />;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading outstanding dues…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 space-y-3">
          <div className="flex items-center gap-2 text-rose-600 text-sm">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
          <Button size="sm" variant="outline" onClick={() => { setLoading(true); setError(""); }}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { customersOutstanding, totalAmount, totalCustomers } = reportData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/reports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Outstanding dues</h1>
            <p className="text-sm text-muted-foreground">List of customer balances and days overdue</p>
          </div>
        </div>
        
        {totalCustomers > 0 && (
          <a href={`/api/reports/outstanding/pdf`} target="_blank" rel="noreferrer">
            <Button className="gap-1.5">
              <FileDown className="h-4 w-4" />
              <span>Download PDF Report</span>
            </Button>
          </a>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase text-muted-foreground tracking-wide">Total Customers</div>
            <div className="text-2xl font-semibold mt-1">{totalCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase text-muted-foreground tracking-wide">Total Outstanding</div>
            <div className="text-2xl font-semibold mt-1 text-amber-600">{formatINR(totalAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase text-muted-foreground tracking-wide">Company</div>
            <div className="text-lg font-medium mt-1 truncate">{active.name}</div>
          </CardContent>
        </Card>
      </div>

      {customersOutstanding.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No outstanding dues found! All customers have paid up.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {customersOutstanding.map((cust) => (
            <Card key={cust.id} className="overflow-hidden">
              <CardHeader className="bg-muted/10 border-b py-3">
                <CardTitle className="text-sm font-semibold tracking-wide uppercase">
                  {cust.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <THead>
                    <TR>
                      <TH className="w-28 pl-4">Date</TH>
                      <TH className="text-center">Ref. No.</TH>
                      <TH className="text-right">Pending Amount</TH>
                      <TH className="text-center">Due on</TH>
                      <TH className="text-center pr-4">Overdue by days</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {cust.rows.map((row, idx) => (
                      <TR key={idx}>
                        <TD className="pl-4">{formatDate(row.date)}</TD>
                        <TD className="text-center font-medium font-mono">{row.refNo}</TD>
                        <TD className="text-right font-semibold text-amber-600">
                          {formatINR(row.pendingAmount)}
                        </TD>
                        <TD className="text-center">{formatDate(row.dueOn)}</TD>
                        <TD className="text-center pr-4 font-mono text-xs">
                          {row.overdueDays > 0 ? (
                            <span className="text-destructive font-bold">{row.overdueDays} d</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TD>
                      </TR>
                    ))}
                    <TR className="bg-muted/5 font-semibold border-t">
                      <TD className="pl-4"></TD>
                      <TD className="text-center">Total</TD>
                      <TD className="text-right text-amber-600 font-bold">
                        {formatINR(cust.totalPending)}
                      </TD>
                      <TD className="text-center"></TD>
                      <TD className="text-center pr-4"></TD>
                    </TR>
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-center pt-4">
            <Card className="w-full max-w-md">
              <CardContent className="p-4 text-center border-2 border-dashed border-muted">
                <div className="text-xs uppercase text-muted-foreground tracking-wide font-medium">Grand Total Outstanding</div>
                <div className="text-3xl font-extrabold text-amber-600 mt-1">{formatINR(totalAmount)}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Regards Footer */}
      <div className="pt-8 border-t text-sm text-muted-foreground space-y-1">
        <p>Regards,</p>
        <p className="font-semibold text-foreground uppercase">{active.name}</p>
        {active.address && <p>{active.address}</p>}
        {active.city && <p>{[active.city, active.state, active.pincode].filter(Boolean).join(", ")}</p>}
        {active.phone && <p>Phone no. : {active.phone}</p>}
        {active.gstNumber && <p>GSTIN : {active.gstNumber}</p>}
        {active.email && <p>E-Mail : {active.email}</p>}
      </div>
    </div>
  );
}
