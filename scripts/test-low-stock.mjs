// Self-check: an item's own threshold wins; 0 falls back to the company default; 0 default means no alert.
// Run: node scripts/test-low-stock.mjs
import assert from "node:assert/strict";
import { alertLevel, isLowStock } from "../lib/stock.js";

assert.equal(alertLevel({ lowStockThreshold: 5 }, 10), 5, "own threshold wins");
assert.equal(alertLevel({ lowStockThreshold: 0 }, 10), 10, "0 uses the company default");
assert.equal(alertLevel({ lowStockThreshold: 0 }, 0), 0, "no default and no own: no level");
assert.equal(alertLevel({ lowStockThreshold: "3" }, 0), 3, "stored as text still works");

assert.equal(isLowStock({ quantity: 10, lowStockThreshold: 10 }), true, "at the level is low");
assert.equal(isLowStock({ quantity: 11, lowStockThreshold: 10 }), false, "above the level is fine");
assert.equal(isLowStock({ quantity: 4, lowStockThreshold: 0 }, 5), true, "default applies");
assert.equal(isLowStock({ quantity: 4, lowStockThreshold: 0 }, 0), false, "default off: no alert");
assert.equal(isLowStock({ quantity: 4, lowStockThreshold: 2 }, 5), false, "own threshold beats default");
assert.equal(isLowStock({ quantity: -3, lowStockThreshold: 0 }, 5), true, "negative stock is low when a level applies");
console.log("low-stock self-check passed");
