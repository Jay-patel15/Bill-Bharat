// Self-check: the "thanks for updating" popup shows once per newer version, never on a new install,
// and never for a downgrade. Run: node scripts/test-whats-new.mjs
import assert from "node:assert/strict";
import { whatsNewState, isNewer } from "../lib/whats-new.js";

assert.equal(isNewer("1.0.6", "1.0.5"), true);
assert.equal(isNewer("1.0.5", "1.0.6"), false);
assert.equal(isNewer("1.1.0", "1.0.9"), true, "minor beats patch");
assert.equal(isNewer("2.0.0", "1.9.9"), true);
assert.equal(isNewer("1.0.6", "1.0.6"), false);

// New install (no books, nothing seen): no popup, but remember the version.
assert.deepEqual(whatsNewState({ current: "1.0.6", seen: null, hasCompanies: false }), { show: false, markSeen: true });
// Update from 1.0.5 with books: show it.
assert.deepEqual(whatsNewState({ current: "1.0.6", seen: "1.0.5", hasCompanies: true }), { show: true, markSeen: false });
// Books exist but the version was never recorded (updating from before this feature): show it.
assert.deepEqual(whatsNewState({ current: "1.0.6", seen: null, hasCompanies: true }), { show: true, markSeen: false });
// Already dismissed for this version: nothing.
assert.deepEqual(whatsNewState({ current: "1.0.6", seen: "1.0.6", hasCompanies: true }), { show: false, markSeen: false });
// Downgrade: no popup, remember the lower version.
assert.deepEqual(whatsNewState({ current: "1.0.5", seen: "1.0.6", hasCompanies: true }), { show: false, markSeen: true });
// No version known: nothing.
assert.deepEqual(whatsNewState({ current: "", seen: null, hasCompanies: true }), { show: false, markSeen: false });
console.log("whats-new self-check passed");
