"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV } from "@/lib/navigation";

/**
 * Left navigation. On desktop it is a full-height column. Below md it is a drawer that the
 * top bar's menu button opens; it closes on Escape, on the backdrop and after a link is picked.
 */
export function Sidebar({ onLogout, open = false, onClose }) {
  const pathname = usePathname() || "";
  const activeHref = NAV
    .map((n) => n.href)
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        id="app-sidebar"
        aria-label="Main navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex-col border-r bg-card transition-transform duration-200",
          "md:sticky md:top-0 md:z-auto md:flex md:h-screen md:w-52 md:shrink-0 md:translate-x-0 md:transition-none xl:w-64",
          open ? "flex translate-x-0" : "invisible -translate-x-full md:visible"
        )}
      >
        <div className="px-5 py-4 border-b">
          <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2 text-primary font-bold">
            <img src="/icon.svg" alt="" className="h-8 w-8" />
            <span>BillBharat</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.href === activeHref;

            if (item.disabled || item.comingSoon) {
              return (
                <div
                  key={item.href}
                  className="flex items-center justify-between px-3 py-2 rounded-md text-sm text-muted-foreground/40 bg-muted/20 cursor-not-allowed select-none my-0.5"
                  title="This feature is disabled"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 opacity-40" />
                    <span className="line-through opacity-60">{item.label}</span>
                  </div>
                  <span className="text-[9px] font-bold uppercase bg-muted px-1.5 py-0.5 rounded text-muted-foreground/50 border">
                    Disabled
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
          className="m-3 flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground/80 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>
    </>
  );
}
