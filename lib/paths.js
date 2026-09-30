/**
 * lib/paths.js — where local data lives.
 *
 * Packaged app: Electron sets BILLBHARAT_DATA_DIR to %APPDATA%/BillBharat.
 * Dev:          ./.data (gitignored) so `npm run dev` needs zero setup.
 */

import fs from "node:fs";
import path from "node:path";

export function dataDir() {
  const dir = process.env.BILLBHARAT_DATA_DIR?.trim() || path.join(process.cwd(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function filesDir() {
  const dir = path.join(dataDir(), "files");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function dbPath() {
  return path.join(dataDir(), "billbharat.db");
}
