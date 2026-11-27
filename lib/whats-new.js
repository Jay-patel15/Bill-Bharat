/**
 * "Thanks for updating" popup: what each release added.
 * Add an entry for every release. A version without an entry still gets the thank-you, with a generic line.
 * The rule for when to show it is whatsNewState(); it is a pure function so it can be tested.
 */
export const WHATS_NEW = {
  "1.0.7": [
    "Quotations: track Draft, Sent, Accepted and Converted; edit them; convert one to an invoice in a click. Quotations do not affect stock, payments or sales totals.",
    "Quotations print a valid-till note and a market-price note. Each quotation has its own template, with a preview before you save.",
    "Import products or product names from a CSV file. Delete an invoice or quotation from its page.",
    "Shortcuts: F7 new customer, F6 new item, F4 AI purchase reader."
  ],
  "1.0.6": [
    "WhatsApp from the desktop app now sends the invoice PDF with the message. The PDF is copied so you can paste it into the chat with Ctrl+V, and its folder opens so you can drag it in too.",
    "After every update, a short thank-you message lists what the new version added."
  ],
  "1.0.5": [
    "Lump-sum payments: one amount from a customer or to a supplier settles the oldest bills first. You see the split before you save.",
    "Print preview with Print and Save as, for invoices and statements.",
    "Low stock alert default in Settings; items without their own threshold use it.",
    "A menu for phones and small tablets, and layout fixes for narrow screens."
  ]
};

/** True when version a is higher than version b (both "x.y.z"). */
export function isNewer(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * current:      the version running now
 * seen:         the version the popup was last dismissed for (null if never)
 * hasCompanies: whether there are books already (an update), or this is a new install
 * Returns { show, markSeen }. markSeen writes `current` so the popup does not come back.
 */
export function whatsNewState({ current, seen, hasCompanies }) {
  if (!current) return { show: false, markSeen: false };
  if (seen === current) return { show: false, markSeen: false };
  // New install: nothing to update from, so never greet with the popup.
  if (!seen && !hasCompanies) return { show: false, markSeen: true };
  // A downgrade or an older build: do not show, but remember this version.
  if (seen && !isNewer(current, seen)) return { show: false, markSeen: true };
  return { show: true, markSeen: false };
}
