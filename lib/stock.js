/**
 * Low-stock rule, shared by the server (dashboard, settings) and the screens.
 * An item's own threshold wins. An item with 0 uses the company default from Settings.
 * A level of 0 means no alert.
 */
export const lowStockKey = (companyId) => `low_stock_threshold:${companyId}`;

/** The level an item alerts at: its own threshold, else the company default. */
export function alertLevel(item, companyDefault = 0) {
  const own = Number(item.lowStockThreshold) || 0;
  return own > 0 ? own : Math.max(0, Number(companyDefault) || 0);
}

export function isLowStock(item, companyDefault = 0) {
  const level = alertLevel(item, companyDefault);
  return level > 0 && Number(item.quantity || 0) <= level;
}
