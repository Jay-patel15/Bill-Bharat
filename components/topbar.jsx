"use client";
import Link from "next/link";
import { ChevronDown, Plus, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { useCompany } from "./company-context";

export function Topbar({ user }) {
  const { companies, active, setActive } = useCompany();
  const [open, setOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const isDark =
      document.documentElement.classList.contains("dark") ||
      localStorage.getItem("theme") === "dark" ||
      (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    } else {
      document.documentElement.classList.remove("dark");
      setDarkMode(false);
    }
  }, []);

  function toggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  return (
    <header className="h-14 border-b bg-background/80 backdrop-blur sticky top-0 z-30 flex items-center justify-between px-5">
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setOpen((s) => !s)}
            className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent"
          >
            <span className="font-medium truncate max-w-[200px]">{active?.name || "Select Company"}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          {open && (
            <div className="absolute mt-2 w-72 bg-background border rounded-md shadow-xl p-1 z-40">
              {companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setActive(c.id); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-accent ${active?.id === c.id ? "bg-accent" : ""}`}
                >
                  <div className="font-medium">{c.name}</div>
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
          <Link href="/sales/create-invoice">
            <button className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 shadow-sm transition-all font-medium">
              <Plus className="h-4 w-4" /> 
              <span>New Invoice</span>
            </button>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={toggleDark}
          className="p-2 rounded-md border bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700 dark:text-slate-200" />}
        </button>

        <div className="hidden sm:block text-right mr-1">
          <div className="font-medium leading-none">{user?.name}</div>
          <div className="text-[11px] text-muted-foreground">{user?.email}</div>
        </div>
        <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold">
          {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
