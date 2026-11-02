/**
 * Network boundary for the local server: outbound fetch() may only reach this
 * machine or the Gemini API (used only when the user asks AI to read a bill).
 * Anything else fails loudly instead of quietly phoning home.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Gemini is the only remote host: services/ai/gemini_service.js, used only when the user asks AI to read a bill.
  const allowed = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "generativelanguage.googleapis.com"]);
  const realFetch = globalThis.fetch;

  globalThis.fetch = (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url, "http://localhost");
    if (!allowed.has(url.hostname)) {
      return Promise.reject(new Error(`Blocked network request to ${url.hostname}: BillBharat works offline`));
    }
    return realFetch(input, init);
  };
}
