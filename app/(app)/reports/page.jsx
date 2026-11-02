import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportsNav } from "@/components/reports-nav";

const REPORTS = [
  { href: "/reports/sales", title: "Sales report", desc: "Invoice-level sales with tax breakdown." },
  { href: "/reports/gst", title: "GST report", desc: "GSTR-friendly summary of CGST, SGST, IGST." },
  { href: "/reports/finance", title: "Finance overview", desc: "Receivables, payables, profit." },
  { href: "/reports/outstanding", title: "Outstanding dues", desc: "What customers owe you and what you owe suppliers." },
  { href: "/reports/ledger", title: "Party ledger", desc: "One customer or supplier: bill amount, paid, balance, running ledger." },
  { href: "/reports/daybook", title: "Rojmel (Cash Book)", desc: "Money in (Debit) and out (Credit) with running balance." },
  { href: "/reports/audit", title: "Audit log", desc: "System change logs and deletion records." }
];

export default function ReportsHub() {
  return (
    <div className="space-y-6">
      <ReportsNav />
      <h1 className="text-2xl font-semibold">Reports Overview</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle>{r.title}</CardTitle>
                <CardDescription>{r.desc}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-primary">View →</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
