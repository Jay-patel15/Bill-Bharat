/**
 * Payment arithmetic shared by the server (payment routes) and the screens
 * (sales invoice, purchase bill). A document's paid amount is the sum of its
 * payment rows; an edit replaces one row, so that row's old amount is left out
 * when checking how much room is left.
 */
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Sum of the payment rows' amounts. */
export function sumPaid(payments = []) {
  return round2(payments.reduce((s, p) => s + Number(p.amount || 0), 0));
}

/**
 * Where a document stands.
 *   paid    — everything received so far
 *   pending — total minus paid (never below zero)
 *   room    — the most a new payment (or the payment being edited) may be
 */
export function paymentState({ total = 0, payments = [], editingId = null } = {}) {
  const t = round2(total);
  const paid = sumPaid(payments);
  const editing = editingId ? payments.find((p) => p.id === editingId) : null;
  const others = editing ? round2(paid - Number(editing.amount || 0)) : paid;
  return {
    paid,
    pending: Math.max(0, round2(t - paid)),
    room: Math.max(0, round2(t - others)),
    editing: editing || null
  };
}

/** Amount above the room left, or 0. */
export function excessOver(amount, room) {
  const over = round2(Number(amount) - room);
  return over > 0 ? over : 0;
}

/** Party key for grouping bills by supplier name: ignores case and spaces; blank names share one group. */
export const supplierKey = (name) => String(name || "").trim().toLowerCase() || "unknown supplier";

/** Pay order for a lump sum: oldest bill first, then by bill number. Items need {date, number}. */
export function oldestFirst(a, b) {
  return String(a.date || "").localeCompare(String(b.date || ""))
    || String(a.number || "").localeCompare(String(b.number || ""), undefined, { numeric: true });
}

/**
 * Splits one lump sum over bills already in pay order. Each bill takes what it still owes
 * until the sum runs out. Items need {id, pending}. Returns the parts paid and what is left.
 */
export function allocateLumpSum(bills, amount) {
  let left = round2(amount);
  const parts = [];
  for (const b of bills) {
    if (left <= 0) break;
    const part = round2(Math.min(round2(b.pending), left));
    if (part <= 0) continue;
    parts.push({ id: b.id, amount: part });
    left = round2(left - part);
  }
  return { parts, left };
}
