/**
 * lib/google/sheets.js — DEPRECATED
 *
 * This module was a legacy backend that used the Supabase JS client as an
 * intermediary for Google Sheets operations. It has been superseded by:
 *
 *   lib/db.js  →  Direct PostgreSQL via node-postgres (pg)
 *
 * This file is preserved for reference only. No active code paths import from it.
 * The Supabase client dependency has been removed from package.json.
 *
 * DO NOT USE — will be removed in a future cleanup PR.
 */

export async function bootstrap() {
  throw new Error("sheets.js is deprecated. Use lib/db.js (PostgreSQL) instead.");
}

export async function listAll() {
  throw new Error("sheets.js is deprecated. Use lib/db.js (PostgreSQL) instead.");
}

export async function findWhere() {
  throw new Error("sheets.js is deprecated. Use lib/db.js (PostgreSQL) instead.");
}

export async function findOne() {
  throw new Error("sheets.js is deprecated. Use lib/db.js (PostgreSQL) instead.");
}

export async function findById() {
  throw new Error("sheets.js is deprecated. Use lib/db.js (PostgreSQL) instead.");
}

export async function insert() {
  throw new Error("sheets.js is deprecated. Use lib/db.js (PostgreSQL) instead.");
}

export async function update() {
  throw new Error("sheets.js is deprecated. Use lib/db.js (PostgreSQL) instead.");
}

export async function remove() {
  throw new Error("sheets.js is deprecated. Use lib/db.js (PostgreSQL) instead.");
}
