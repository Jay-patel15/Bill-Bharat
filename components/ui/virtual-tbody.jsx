"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const BUFFER = 20;

/**
 * Drop-in <tbody> for long registers inside <Table> (which scrolls). Up to
 * `threshold` rows render normally; beyond that only the visible rows plus a
 * buffer are in the DOM, with spacer rows keeping the scrollbar honest.
 * Assumes rows of roughly equal height (measured from the first row).
 *
 *   <VirtualTBody items={list} colSpan={8}>{(row, i) => <TR key={row.id}>…</TR>}</VirtualTBody>
 */
export function VirtualTBody({ items, colSpan, threshold = 150, children }) {
  const ref = useRef(null);
  const [rowH, setRowH] = useState(40);
  const [view, setView] = useState({ top: 0, height: 900 });
  const virtual = items.length > threshold;

  useEffect(() => {
    const body = ref.current;
    const box = body?.closest(".overflow-auto");
    if (!box) return;
    const update = () => setView({ top: box.scrollTop - body.offsetTop, height: box.clientHeight });
    update();
    box.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { box.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  useLayoutEffect(() => {
    const first = ref.current?.querySelector("tr:not([data-spacer])");
    if (first?.offsetHeight) setRowH(first.offsetHeight);
  }, [virtual, items.length]);

  if (!virtual) return <tbody ref={ref} className="[&_tr:last-child]:border-0">{items.map(children)}</tbody>;

  const start = Math.max(0, Math.floor(view.top / rowH) - BUFFER);
  const end = Math.min(items.length, Math.ceil((view.top + view.height) / rowH) + BUFFER);
  return (
    <tbody ref={ref}>
      {start > 0 && <tr data-spacer aria-hidden style={{ height: start * rowH }}><td colSpan={colSpan} /></tr>}
      {items.slice(start, end).map((row, i) => children(row, start + i))}
      {end < items.length && <tr data-spacer aria-hidden style={{ height: (items.length - end) * rowH }}><td colSpan={colSpan} /></tr>}
    </tbody>
  );
}
