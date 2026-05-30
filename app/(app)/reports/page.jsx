import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const REPORTS = [
  { href: "/reports/sales", title: "Sales report", desc: "Invoice-level sales with tax breakdown." },
  { href: "/reports/gst", title: "GST report", desc: "GSTR-friendly summary of CGST, SGST, IGST." },
  { href: "/reports/finance", title: "Finance overview", desc: "Receivables, payables, profit." },
  { href: "/reports/outstanding", title: "Outstanding dues", desc: "Outstanding dues grouped by customer." }
];

export default function ReportsHub() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
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
