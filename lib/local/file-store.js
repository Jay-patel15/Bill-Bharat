/**
 * Local file storage that mirrors the Drive adapter API. Files live under
 * /public/uploads/<subfolder>/ so Next.js serves them at /uploads/...
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public", "uploads");

function safeName(name) {
  return (name || `file-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function uploadFile({ data, filename, mimeType, subfolder = "files" }) {
  const dir = path.join(ROOT, subfolder);
  await fs.mkdir(dir, { recursive: true });
  const finalName = `${Date.now()}-${safeName(filename)}`;
  const full = path.join(dir, finalName);
  const buf = Buffer.isBuffer(data) ? data : await streamToBuffer(data);
  await fs.writeFile(full, buf);
  const relUrl = `/uploads/${subfolder}/${finalName}`;
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  const url = base ? `${base}${relUrl}` : relUrl;
  return { id: finalName, name: filename, viewUrl: url, downloadUrl: url, embedUrl: url };
}

export async function downloadFile(id) {
  const dirs = await fs.readdir(ROOT, { withFileTypes: true }).catch(() => []);
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const p = path.join(ROOT, d.name, id);
    try { return await fs.readFile(p); } catch {}
  }
  throw new Error(`file ${id} not found`);
}

export async function deleteFile(id) {
  const dirs = await fs.readdir(ROOT, { withFileTypes: true }).catch(() => []);
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const p = path.join(ROOT, d.name, id);
    try { await fs.unlink(p); return; } catch {}
  }
}
