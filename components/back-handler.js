"use client";

/**
 * Back button and Esc. The app remembers the pages opened in this session, so Back returns to
 * the page you came from (not the dashboard, and not a page you had replaced after saving).
 * A page with an inner view (a supplier's bills) registers how Back closes that view first.
 */
const visits = [];
let innerBack = null;

/** Called by the top bar whenever the page changes. */
export function recordVisit(url) {
  if (visits[visits.length - 1] === url) return;
  visits.push(url);
  if (visits.length > 100) visits.shift();
}

/** Remove the page we are on from the Back history (used before replacing it). */
export function dropCurrentVisit() {
  visits.pop();
}

/** Replace the current page without leaving it in the Back history (after a save or delete). */
export function navReplace(router, href) {
  dropCurrentVisit();
  router.replace(href);
}

/** A page with an inner view registers how Back closes it. Returns the function that removes it. */
export function setInnerBack(fn) {
  innerBack = fn;
  return () => { if (innerBack === fn) innerBack = null; };
}

/** Back: close the inner view if one is open, otherwise go to the page opened before this one. */
export function goBack(router) {
  if (innerBack) return innerBack();
  visits.pop();                 // the page we are on
  const previous = visits.pop(); // it is recorded again when it opens
  router.push(previous || "/dashboard");
}
