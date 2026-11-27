"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { OPEN_QUICK_CREATE } from "./quick-create";
import { goBack } from "./back-handler";

/** Keys that open a new sale or purchase. */
export const VOUCHER_KEYS = {
  F8: { href: "/sales/create-invoice", label: "Sales" },
  F9: { href: "/purchase/create", label: "Purchase" },
  F7: { href: "/customers", label: "New customer", openForm: true },
  F6: { href: "/inventory", label: "New item", openForm: true },
  F4: { href: "/purchase/ai-upload", label: "AI purchase" }
};

const FIELDS = "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[type=submit]:not([disabled])";

const visible = (f) => f.offsetParent !== null;

/** Enter on the last cell of the last row of a [data-grid] adds a row and focuses it. */
function addGridRow(el) {
  const row = el.closest("[data-grid-row]");
  const grid = row?.closest("[data-grid]");
  if (!grid) return false;
  const cells = [...row.querySelectorAll("input, select, textarea")].filter(visible);
  const rows = grid.querySelectorAll("[data-grid-row]");
  if (el !== cells.at(-1) || row !== rows[rows.length - 1]) return false;
  grid.querySelector("[data-add-row]")?.click();
  setTimeout(() => {
    const last = [...grid.querySelectorAll("[data-grid-row]")].at(-1);
    last?.querySelector("input, select, textarea")?.focus();
  }, 0);
  return true;
}

function nextField(el) {
  const scope = el.form || document;
  const list = [...scope.querySelectorAll(FIELDS)].filter((f) => f.offsetParent !== null);
  return list[list.indexOf(el) + 1] || null;
}

/**
 * Global keys, mounted once in the app shell:
 *   Enter  next field (submits on the last one)    Esc  close dialog / go back
 *   Alt+A  accept (save) the current form          F2   jump to the date field
 *   Alt+C  quick-create a customer, or an item when in an item grid
 *   F8, F9         open a new sale or purchase
 *   F7, F6         open the new-customer or new-item form on its page
 *   F4             open the AI purchase reader
 */
export function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function onKey(e) {
      const el = document.activeElement;

      if (VOUCHER_KEYS[e.key] && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        const k = VOUCHER_KEYS[e.key];
        // A new value each press, so the page opens its form even when it is already showing.
        router.push(k.openForm ? `${k.href}?new=${Date.now()}` : k.href);
        return;
      }

      if (e.key === "F2") {
        const date = document.querySelector("input[type=date]:not([disabled])");
        if (date) { e.preventDefault(); date.focus(); date.showPicker?.(); }
        return;
      }

      // e.code (physical key) instead of e.key: Alt+letter gives a different character on some keyboard layouts.
      if (e.altKey && e.code === "KeyA") {
        // Forms submit; screens without a form mark their save button with data-accept.
        const form = el?.form || document.querySelector("[role=dialog] form") || document.querySelector("main form");
        const accept = form ? null : document.querySelector("main [data-accept]:not([disabled])");
        if (form || accept) { e.preventDefault(); form ? form.requestSubmit() : accept.click(); }
        return;
      }

      if (e.altKey && e.code === "KeyC") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(OPEN_QUICK_CREATE, { detail: { kind: el?.closest?.("[data-grid]") ? "item" : "customer" } }));
        return;
      }

      if (e.key === "Escape") {
        // Dialogs close themselves; only leave the screen when none is open.
        if (document.querySelector("[role=dialog]")) return;
        if (el && el !== document.body && el.matches("input, select, textarea")) { el.blur(); return; }
        goBack(router);
        return;
      }

      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey && el?.matches("input, select, textarea[data-single-line]")
          && !["checkbox", "radio", "file", "submit", "button"].includes(el.type)) {
        if (addGridRow(el)) { e.preventDefault(); return; }
        const next = nextField(el);
        if (!next) return; // last field: let Enter submit as usual
        e.preventDefault();
        if (next.matches("button[type=submit]")) { el.form?.requestSubmit(); return; }
        next.focus();
        next.select?.();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
