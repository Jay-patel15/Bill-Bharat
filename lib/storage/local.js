/**
 * lib/storage/local.js — local disk storage adapter.
 *
 * Keeps the interface the previous cloud adapter exposed, so callers are
 * unchanged:
 *   uploadFile({ data, filename, mimeType, subfolder }) → { id, name, viewUrl, downloadUrl, embedUrl }
 *   downloadFile(id) → Buffer
 *   deleteFile(id) → void
 *
 * Files live at <dataDir>/files/<subfolder>/<timestamp>-<filename> and are
 * served back through /api/files/<id>. `id` is the subfolder-relative path,
 * matching the old object-key semantics.
 */

import fs from "node:fs";
import path from "node:path";
import { filesDir } from "../paths.js";

function safeName(name) {
  return (name || `file-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Resolve a storage id to an absolute path, refusing anything that escapes
 * the files directory. Ids reach us from request paths, so this is a trust
 * boundary even on a local-only app.
 */
export function resolveStoragePath(id) {
  const root = filesDir();
  const target = path.resolve(root, id);
  const rel = path.relative(root, target);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Invalid file path");
  }
  return target;
}

export async function uploadFile({ data, filename, mimeType, subfolder = "files" }) {
  const folder = safeName(subfolder) || "files";
  const objectKey = `${folder}/${Date.now()}-${safeName(filename)}`;
  const target = resolveStoragePath(objectKey);

  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, data);

  const url = `/api/files/${objectKey}`;
  return {
    id: objectKey,
    name: filename,
    mimeType: mimeType || "application/octet-stream",
    viewUrl: url,
    downloadUrl: url,
    embedUrl: url
  };
}

export async function downloadFile(id) {
  return fs.promises.readFile(resolveStoragePath(id));
}

export async function deleteFile(id) {
  await fs.promises.rm(resolveStoragePath(id), { force: true });
}
