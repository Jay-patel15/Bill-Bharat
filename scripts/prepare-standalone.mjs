/**
 * Next's standalone output ships server.js and a traced node_modules, but
 * deliberately leaves out the static assets and the public folder — they are
 * expected to be served by a CDN. We serve them from the same process, so
 * copy them into the bundle where server.js looks for them.
 *
 * Run after `next build`, before packaging.
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

if (!fs.existsSync(standalone)) {
  console.error('Missing .next/standalone — run "next build" with output: "standalone" first.');
  process.exit(1);
}

const copies = [
  [path.join(root, ".next", "static"), path.join(standalone, ".next", "static")],
  [path.join(root, "public"), path.join(standalone, "public")]
];

for (const [from, to] of copies) {
  if (!fs.existsSync(from)) continue;
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  console.log(`copied ${path.relative(root, from)} -> ${path.relative(root, to)}`);
}

// File tracing can miss the driver's .wasm because it is loaded at runtime
// rather than required. Verify rather than discover it at first query.
const wasm = path.join(standalone, "node_modules", "node-sqlite3-wasm", "dist", "node-sqlite3-wasm.wasm");
if (!fs.existsSync(wasm)) {
  console.error(`SQLite wasm binary missing from the bundle: ${wasm}`);
  process.exit(1);
}
console.log("sqlite wasm present ✓");
