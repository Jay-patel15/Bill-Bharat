"use client";
import { useMemo, useState } from "react";
import { Textarea } from "@/components/ui/input";
import { cn, fuzzyScore, formatINR } from "@/lib/utils";

/**
 * Type-ahead item picker. Searches name, SKU, barcode and HSN; ↑/↓ to move,
 * Enter to pick (then the global Enter handler moves to the next field),
 * Esc to close. A scanned barcode or SKU that matches exactly is picked on Enter.
 * Free text is kept as the item name, so non-stock items still work.
 * The box grows with the text so long product names stay fully visible.
 */
export function ItemSearch({ value, items, onText, onPick, onBlur, placeholder = "Search item, SKU or barcode" }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);

  const matches = useMemo(() => {
    if (!value?.trim()) return [];
    return items
      .map((it) => ({ it, score: Math.max(fuzzyScore(value, it.name), fuzzyScore(value, it.sku), fuzzyScore(value, it.barcode), fuzzyScore(value, it.hsnCode) - 10) }))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((m) => m.it);
  }, [value, items]);

  function pick(it) {
    onPick(it);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === "Enter") e.preventDefault(); // single-line field: never insert a newline
    const exact = items.find((it) => value && (it.barcode === value.trim() || it.sku === value.trim()));
    if (e.key === "Enter" && exact) return pick(exact);
    if (!open || !matches.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") pick(matches[hi]);
    else if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
  }

  return (
    <div className="relative">
      <Textarea
        rows={1}
        data-single-line
        className="min-h-10 h-auto resize-none overflow-hidden [field-sizing:content]"
        value={value}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-autocomplete="list"
        onChange={(e) => { onText(e.target.value.replace(/\s*\n\s*/g, " ")); setOpen(true); setHi(0); }}
        onKeyDown={onKeyDown}
        onBlur={() => { setTimeout(() => setOpen(false), 120); onBlur?.(); }}
      />
      {open && matches.length > 0 && (
        <ul role="listbox" className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-background shadow-lg text-sm">
          {matches.map((it, i) => (
            <li
              key={it.id}
              role="option"
              aria-selected={i === hi}
              onMouseDown={(e) => { e.preventDefault(); pick(it); }}
              onMouseEnter={() => setHi(i)}
              className={cn("flex justify-between gap-2 px-2 py-1 cursor-pointer", i === hi && "bg-accent")}
            >
              <span>{it.name}{it.sku ? <span className="text-muted-foreground"> · {it.sku}</span> : null}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatINR(it.sellingPrice)} · stock {it.quantity}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
