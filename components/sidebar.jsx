"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Building2, Users, Package, FileText, ShoppingCart,
  BarChart3, Sparkles, LogOut, FolderKanban, Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/projects", label: "Projects (BOQ)", icon: FolderKanban },
  { href: "/sales", label: "Sales / Invoices", icon: FileText },
  { href: "/purchase", label: "Purchases", icon: ShoppingCart },
  { href: "/purchase/ai-upload", label: "AI Purchase Reader", icon: Sparkles },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar({ onLogout }) {
  const pathname = usePathname() || "";
  // Pick the single longest nav href that the current URL matches, so a parent
  // (/purchase) doesn't light up alongside its child (/purchase/ai-upload).
  const activeHref = NAV
    .map((n) => n.href)
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card">
      <div className="px-5 py-4 border-b">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-primary text-primary-foreground grid place-items-center font-bold">B</div>
          <div>
            <div className="font-semibold leading-none">BillBharat</div>
            <div className="text-[11px] text-muted-foreground">GST · Inventory · Finance</div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-accent"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={onLogout}
        className="m-3 flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground/80 hover:bg-accent"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </aside>
  );
}
