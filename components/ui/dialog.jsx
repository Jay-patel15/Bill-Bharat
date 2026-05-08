"use client";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function Dialog({ open, onClose, title, children, footer, size = "md" }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-5xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn("w-full bg-background rounded-lg shadow-xl border max-h-[90vh] overflow-hidden flex flex-col", widths[size])}
      >
        {title ? (
          <div className="border-b px-5 py-3">
            <h3 className="text-base font-semibold">{title}</h3>
          </div>
        ) : null}
        <div className="overflow-auto p-5 flex-1">{children}</div>
        {footer ? <div className="border-t px-5 py-3 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
