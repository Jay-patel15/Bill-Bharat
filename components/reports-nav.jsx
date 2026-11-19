"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const REPORT_TABS = [
  { href: "/reports/sales", label: "Sales Report" },
  { href: "/reports/gst", label: "GST Report" },
  { href: "/reports/finance", label: "Finance Overview" },
  { href: "/reports/outstanding", label: "Outstanding Dues" },
  { href: "/reports/ledger", label: "Party Ledger" },
  { href: "/reports/audit", label: "Audit Log" }
];

export function ReportsNav() {
  const pathname = usePathname() || "";

  return (
    <div className="flex flex-wrap gap-2 pb-2 border-b">
      {REPORT_TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border",
              active
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background text-foreground/80 hover:bg-accent border-border"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
