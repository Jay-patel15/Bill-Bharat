"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";

const CompanyCtx = createContext(null);
const STORAGE_KEY = "bb.activeCompanyId";

export function CompanyProvider({ initialCompanies = [], children }) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (companies.length === 0) {
      setActiveId(null);
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const found = stored && companies.find((c) => c.id === stored);
    const next = found ? stored : companies[0].id;
    setActiveId(next);
    // Always sync localStorage so the api() helper sees the right id even if
    // the user never opened the switcher.
    window.localStorage.setItem(STORAGE_KEY, next);
  }, [companies]);

  const setActive = useCallback((id) => {
    setActiveId(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/companies", { cache: "no-store" });
    const json = await res.json();
    if (json.ok) setCompanies(json.data || []);
  }, []);

  const active = companies.find((c) => c.id === activeId) || null;
  return (
    <CompanyCtx.Provider value={{ companies, active, setActive, refresh, setCompanies }}>
      {children}
    </CompanyCtx.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyCtx);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}

/**
 * Endpoints that need an active company. When no company is selected we
 * short-circuit instead of round-tripping to the server (which would 400).
 */
const COMPANY_SCOPED = [
  "/api/customers", "/api/inventory", "/api/sales", "/api/purchases", "/api/projects", "/api/reports", "/api/journals", "/api/product-mappings"
];

/** Adds the X-Company-Id header automatically. */
export async function api(path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  let cid = null;
  if (typeof window !== "undefined") {
    cid = window.localStorage.getItem(STORAGE_KEY);
    if (cid) headers.set("x-company-id", cid);
  }
  if (!cid && COMPANY_SCOPED.some((p) => path.startsWith(p))) {
    // No active company yet — return a sensible empty payload so callers
    // can render their empty state without surfacing an error overlay.
    if (opts.method && opts.method !== "GET") {
      const err = new Error("Select or create a company first");
      err.status = 400;
      throw err;
    }
    return path.includes("/reports") ? null : [];
  }
  if (opts.body && !(opts.body instanceof FormData) && !headers.get("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(path, { ...opts, headers, cache: "no-store" });
  let json = null;
  try { json = await res.json(); } catch {}
  if (!res.ok || (json && json.ok === false)) {
    const msg = (json && json.error) || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return json?.data ?? json;
}
