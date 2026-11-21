// Server side of the low-stock default: reads the company's level from settings.
import { getSetting } from "./db.js";
import { lowStockKey } from "./stock.js";

/** The company's default low-stock level (0 = off). */
export async function readLowStock(companyId) {
  const n = Number(await getSetting(lowStockKey(companyId)));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
