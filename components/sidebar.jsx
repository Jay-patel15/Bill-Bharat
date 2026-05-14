"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV } from "@/lib/navigation";

export function Sidebar({ onLogout }) {
  const pathname = usePathname() || "";
  const activeHref = NAV
    .map((n) => n.href)
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card h-full">
      <div className="px-5 py-4 border-b">
        <Link href="/dashboard" className="flex items-center gap-2 text-primary font-bold">
          <div className="h-8 w-8 rounded bg-primary text-primary-foreground grid place-items-center">B</div>
          <span>BillBharat</span>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.href === activeHref;
          
          if (item.comingSoon) {
            return (
              <div
                key={item.href}
                className="flex items-center justify-between px-3 py-2 rounded-md text-sm text-muted-foreground/50 cursor-not-allowed select-none"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 opacity-50" />
                  {item.label}
                </div>
                <span className="text-[9px] font-bold uppercase bg-muted px-1 rounded text-muted-foreground/70">Soon</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active ? "bg-primary text-primary-foreground font-semibold" : "text-foreground/80 hover:bg-accent"
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
