import { findById, update } from "./db.js";

/**
 * Consumables: an "Electrical Works" line is a service with a lump-sum amount.
 * The parts used on it (cable, pipe, ...) are stock, so they are issued from
 * inventory but never printed on the invoice.
 */

/** Keep only the parts for a consumables line, checked and stored with the stock item's real name and unit. */
export async function checkConsumables(companyId, lineInventoryId, parts = []) {
  if (parts.length === 0) return [];
  // A line whose item no longer exists (removed by an older version when the option was switched off)
  // still counts as the Electrical Works line, so invoices saved before can be edited.
  const line = lineInventoryId ? await findById("inventory", lineInventoryId) : null;
  const isElectricalLine = lineInventoryId && (!line || (line.companyId === companyId && Number(line.consumables)));
  if (!isElectricalLine) {
    const e = new Error("Consumables can only be recorded on the Electrical Works line");
    e.status = 400;
    throw e;
  }
  const out = [];
  for (const p of parts) {
    const inv = await findById("inventory", p.inventoryId);
    if (!inv || inv.companyId !== companyId || Number(inv.consumables)) {
      const e = new Error("Pick each consumable from the stock list");
      e.status = 400;
      throw e;
    }
    out.push({ inventoryId: inv.id, name: inv.name, unit: inv.unit || "", quantity: Number(p.quantity) });
  }
  return out;
}

/**
 * Move stock for one document's lines. sign -1 issues (sale), +1 returns (sale deleted).
 * The Electrical Works line itself is a service and never moves stock; its parts do.
 */
export async function moveStock(companyId, items, sign, userId) {
  for (const it of items || []) {
    const moves = [...(it.consumablesUsed || [])];
    if (it.inventoryId) moves.unshift({ inventoryId: it.inventoryId, quantity: it.quantity });
    for (const m of moves) {
      const inv = await findById("inventory", m.inventoryId);
      if (!inv || inv.companyId !== companyId || Number(inv.consumables)) continue;
      // Negative stock is allowed and shown, as in Tally; clamping to 0 loses the shortfall.
      await update("inventory", inv.id, { quantity: Number(inv.quantity || 0) + sign * Number(m.quantity || 0) }, userId);
    }
  }
}
