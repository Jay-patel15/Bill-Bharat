"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { goBack, recordVisit } from "./back-handler";
import { ArrowLeft, ChevronDown, Menu, Plus } from "lucide-react";
import { useCompany } from "./company-context";

/** Top bar: menu button (phones and tablets), Back, company switcher, New Invoice, and the user. */
export function Topbar({ user, menuOpen = false, onMenu }) {
  const { companies, active, setActive } = useCompany();
  const [open, setOpen] = useState(false);
  const picker = useRef(null);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => { recordVisit(window.location.pathname + window.location.search); }, [pathname]);

  // The company list closes on Escape and on a click outside it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (picker.current && !picker.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <header className="h-14 border-b bg-background/80 backdrop-blur sticky top-0 z-30 flex items-center justify-between gap-2 px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {onMenu && (
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open navigation menu"
            aria-controls="app-sidebar"
            aria-expanded={menuOpen}
            className="md:hidden inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => goBack(router)}
          title="Back to the previous page"
          aria-label="Back"
          className="flex shrink-0 items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back</span>
        </button>
        <div className="relative min-w-0" ref={picker}>
          <button
            type="button"
            onClick={() => setOpen((s) => !s)}
            aria-haspopup="true"
            aria-expanded={open}
            className="flex max-w-full items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="font-medium truncate max-w-[110px] sm:max-w-[200px]">{active?.name || "Select Company"}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          {open && (
            <div className="absolute left-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-background border rounded-md shadow-xl p-1 z-40">
              {companies.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => { setActive(c.id); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-accent ${active?.id === c.id ? "bg-accent" : ""}`}
                >
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground">{c.gstNumber || "No GSTIN"}</div>
                </button>
              ))}
              <Link href="/companies/create" onClick={() => setOpen(false)} className="flex items-center gap-2 mt-1 px-3 py-2 text-sm rounded hover:bg-accent border-t text-primary">
                <Plus className="h-4 w-4" /> New company
              </Link>
            </div>
          )}
        </div>

        {active && (
          <Link
            href="/sales/create-invoice"
            aria-label="New invoice"
            title="Create a new invoice"
            className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 shadow-sm transition-all font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Invoice</span>
          </Link>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 text-sm">
        <div className="hidden md:block text-right mr-1 min-w-0">
          <div className="font-medium leading-none whitespace-nowrap">{user?.name}</div>
          <div className="text-[11px] text-muted-foreground whitespace-nowrap">{user?.email}</div>
        </div>
        <div aria-hidden="true" className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold">
          {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
