"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => [...s, { id, ...toast }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), toast.duration || 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "min-w-[260px] rounded-md border bg-background shadow-md px-4 py-3",
              t.type === "error" && "border-red-300 text-red-700",
              t.type === "success" && "border-emerald-300 text-emerald-700"
            )}
          >
            {t.title ? <div className="font-semibold text-sm">{t.title}</div> : null}
            {t.message ? <div className="text-sm opacity-80">{t.message}</div> : null}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) return () => {};
  return ctx;
}
