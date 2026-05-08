"use client";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { useCompany } from "./company-context";

export function Topbar({ user }) {
  const { companies, active, setActive } = useCompany();
  const [open, setOpen] = useState(false);

  return (
    <header className="h-14 border-b bg-background/80 backdrop-blur sticky top-0 z-30 flex items-center justify-between px-5">
      <div className="relative">
        <button
          onClick={() => setOpen((s) => !s)}
          className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent"
        >
          <span className="text-muted-foreground">Company:</span>
          <span className="font-medium truncate max-w-[200px]">{active?.name || "No company"}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
        {open ? (
          <div className="absolute mt-2 w-72 bg-popover border rounded-md shadow-lg p-1 z-40 bg-background">
            {companies.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">
                No companies yet.
                <Link href="/companies/create" className="block mt-2 text-primary underline" onClick={() => setOpen(false)}>
                  Create your first company →
                </Link>
              </div>
            ) : (
              <>
                {companies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setActive(c.id); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-accent ${active?.id === c.id ? "bg-accent" : ""}`}
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">{c.gstNumber || "No GSTIN"}</div>
                  </button>
                ))}
                <Link
                  href="/companies/create"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 mt-1 px-3 py-2 text-sm rounded hover:bg-accent border-t"
                >
                  <Plus className="h-4 w-4" /> New company
                </Link>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 text-sm">
        <div className="hidden sm:block">
          <div className="font-medium leading-none">{user?.name}</div>
          <div className="text-[11px] text-muted-foreground">{user?.email}</div>
        </div>
        <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold">
          {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
