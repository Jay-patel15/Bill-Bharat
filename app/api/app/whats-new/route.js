import { fail, ok, withUser } from "@/lib/api";
import { getSetting, listAll, setSetting } from "@/lib/db";
import { WHATS_NEW, whatsNewState } from "@/lib/whats-new";
import pkg from "../../../../package.json";

// Stored in the books, not in the browser: the desktop app's port changes on every start,
// so browser storage would forget the dismissal each time.
const KEY = "whats_new_seen_version";

function currentVersion() {
  return process.env.BILLBHARAT_APP_VERSION || pkg.version;
}

/** GET: whether to show the thank-you popup for this version, and what it says. */
export async function GET() {
  return withUser(async () => {
    try {
      const current = currentVersion();
      const seen = await getSetting(KEY);
      const hasCompanies = (await listAll("companies")).length > 0;
      const { show, markSeen } = whatsNewState({ current, seen, hasCompanies });
      if (markSeen) await setSetting(KEY, current);
      return ok({
        version: current,
        show,
        items: WHATS_NEW[current] || ["Bug fixes and improvements."]
      });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}

/** POST: the popup was dismissed. Records the current version, whatever the client sent. */
export async function POST() {
  return withUser(async () => {
    try {
      await setSetting(KEY, currentVersion());
      return ok({ seen: currentVersion() });
    } catch (e) { return fail(e.message, e.status || 500); }
  });
}
