// Self-check for the Back button history. Run: node scripts/test-back.mjs
import assert from "node:assert/strict";
const { recordVisit, goBack, navReplace, setInnerBack } = await import("../components/back-handler.js");
const pushed = [];
const router = { push: (u) => { pushed.push(u); }, replace: (u) => { pushed.push("replace:" + u); } };
const open = (u) => recordVisit(u); // what the top bar does when the page changes

open("/dashboard"); open("/sales"); open("/sales/create-invoice?type=Tax%20Invoice"); open("/sales/abc");
goBack(router);
assert.equal(pushed.at(-1), "/sales/create-invoice?type=Tax%20Invoice", "back from invoice goes to the page it was opened from");
open("/sales/create-invoice?type=Tax%20Invoice");   // the page we went back to opens again
navReplace(router, "/sales/xyz");                  // a save replaces the form: the form is not kept in history
open("/sales/xyz");
goBack(router);
assert.equal(pushed.at(-1), "/sales", "back after a save goes to the list, not the form");

let closed = 0;
const off = setInnerBack(() => { closed++; });
goBack(router);
assert.equal(closed, 1, "inner view closes first");
off();
open("/purchase"); open("/purchase/create");
goBack(router);
assert.equal(pushed.at(-1), "/purchase");
console.log("back history: all checks passed");
