import { listAll } from "./lib/db.js";

async function check() {
  try {
    const entries = await listAll("ledger_entries");
    console.log("Ledger Entries count:", entries.length);
    console.log("First 5 entries:", entries.slice(0, 5));
  } catch (e) {
    console.error("Error fetching ledger_entries:", e.message);
  }
}

check();
