/**
 * lib/google/drive.js — Storage Backend Router
 *
 * Selects the active storage backend based on environment configuration
 * and re-exports a unified uploadFile / downloadFile / deleteFile interface.
 *
 * Backend selection (in priority order):
 *   1. STORAGE_BACKEND=minio   → MinIO (recommended for self-hosted)
 *   2. STORAGE_BACKEND=drive   → Google Drive
 *   3. STORAGE_BACKEND=local   → Local filesystem (public/uploads/)
 *   4. Auto-detect:
 *      - MINIO_ENDPOINT set    → MinIO
 *      - Google credentials    → Google Drive
 *      - Otherwise             → Local filesystem
 *
 * All callers import from this module and are unaffected by backend changes.
 */

import * as localStore from "../local/file-store.js";
import * as minioStore from "../storage/minio.js";

// ---------------------------------------------------------------------------
// Backend selection
// ---------------------------------------------------------------------------
function selectBackend() {
  const explicit = process.env.STORAGE_BACKEND?.toLowerCase().trim();

  if (explicit === "minio")  return "minio";
  if (explicit === "drive")  return "drive";
  if (explicit === "local")  return "local";

  // Auto-detect
  if (process.env.MINIO_ENDPOINT?.trim()) return "minio";

  const hasGoogleCreds =
    process.env.GOOGLE_CREDENTIALS_JSON?.trim() ||
    process.env.GOOGLE_CREDENTIALS_BASE64?.trim();
  const hasDriveFolder = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (hasGoogleCreds && hasDriveFolder) return "drive";

  return "local";
}

const BACKEND = selectBackend();
console.log(`[storage] Active backend: ${BACKEND}`);

// ---------------------------------------------------------------------------
// Lazy-load Google Drive adapter (avoids importing googleapis when not needed)
// ---------------------------------------------------------------------------
async function getDriveAdapter() {
  const mod = await import("./drive-google.js");
  return mod;
}

// ---------------------------------------------------------------------------
// Exported interface
// ---------------------------------------------------------------------------

export async function uploadFile(opts) {
  if (BACKEND === "minio") return minioStore.uploadFile(opts);
  if (BACKEND === "local") return localStore.uploadFile(opts);
  // drive
  const drive = await getDriveAdapter();
  return drive.driveUploadFile(opts);
}

export async function downloadFile(id) {
  if (BACKEND === "minio") return minioStore.downloadFile(id);
  if (BACKEND === "local") return localStore.downloadFile(id);
  const drive = await getDriveAdapter();
  return drive.driveDownloadFile(id);
}

export async function deleteFile(id) {
  if (BACKEND === "minio") return minioStore.deleteFile(id);
  if (BACKEND === "local") return localStore.deleteFile(id);
  const drive = await getDriveAdapter();
  return drive.driveDeleteFile(id);
}

export { BACKEND as storageBackend };
