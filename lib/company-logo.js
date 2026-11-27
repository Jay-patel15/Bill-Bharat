import fs from "node:fs";
import { resolveStoragePath } from "./storage/local.js";

/** Company logo from the data folder as a data URL jsPDF can embed (PNG/JPEG only). Missing file: null. */
export function loadLogo(logoUrl) {
  const id = String(logoUrl || "").replace(/^\/api\/files\//, "");
  const ext = id.split(".").pop()?.toLowerCase();
  const format = ext === "png" ? "PNG" : ext === "jpg" || ext === "jpeg" ? "JPEG" : null;
  if (!id || !format) return null;
  try {
    const data = fs.readFileSync(resolveStoragePath(id)).toString("base64");
    return { dataUrl: `data:image/${format.toLowerCase()};base64,${data}`, format };
  } catch {
    return null; // missing logo file must not block the invoice
  }
}
