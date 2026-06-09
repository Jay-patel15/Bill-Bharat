/**
 * lib/storage/minio.js — MinIO Storage Adapter
 *
 * Implements the same interface as lib/local/file-store.js so it can be
 * used as a drop-in replacement without changing any callers.
 *
 * Interface:
 *   uploadFile({ data, filename, mimeType, subfolder }) → { id, name, viewUrl, downloadUrl, embedUrl }
 *   downloadFile(id) → Buffer
 *   deleteFile(id) → void
 *
 * Environment variables:
 *   MINIO_ENDPOINT   — hostname of MinIO server (e.g. "minio" in Docker, or "s3.example.com")
 *   MINIO_PORT       — port (default: 9000)
 *   MINIO_USE_SSL    — "true" for HTTPS (default: false for internal Docker network)
 *   MINIO_ACCESS_KEY — MinIO access key / username
 *   MINIO_SECRET_KEY — MinIO secret key / password
 *   MINIO_BUCKET     — bucket name (default: "billbharat-storage")
 *
 * Files are stored at: <bucket>/<subfolder>/<timestamp>-<filename>
 * Pre-signed download URLs are valid for 7 days.
 */

import * as Minio from "minio";

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------
let _client = null;
let _bucketReady = false;

function getClient() {
  if (_client) return _client;

  const endpoint = process.env.MINIO_ENDPOINT;
  if (!endpoint) {
    throw new Error(
      "MINIO_ENDPOINT is not set. " +
      "Example: MINIO_ENDPOINT=minio (Docker) or MINIO_ENDPOINT=s3.example.com"
    );
  }

  _client = new Minio.Client({
    endPoint:  endpoint,
    port:      parseInt(process.env.MINIO_PORT || "9000", 10),
    useSSL:    process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY || "",
    secretKey: process.env.MINIO_SECRET_KEY || ""
  });

  return _client;
}

function getBucket() {
  return process.env.MINIO_BUCKET || "billbharat-storage";
}

/**
 * Ensure the bucket exists. Creates it automatically on first use.
 * Uses a module-level flag so we only check once per process lifetime.
 */
async function ensureBucket() {
  if (_bucketReady) return;
  const client = getClient();
  const bucket = getBucket();
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket, "us-east-1");
    console.log(`[minio] Created bucket: ${bucket}`);
  }
  _bucketReady = true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function safeName(name) {
  return (name || `file-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Generate a 7-day pre-signed GET URL for a given object key */
async function presignedUrl(objectKey) {
  const client = getClient();
  const bucket = getBucket();
  // 7 days in seconds
  return client.presignedGetObject(bucket, objectKey, 7 * 24 * 60 * 60);
}

// ---------------------------------------------------------------------------
// Public interface (mirrors lib/local/file-store.js)
// ---------------------------------------------------------------------------

/**
 * Upload a file to MinIO.
 * @param {{ data: Buffer|Stream, filename: string, mimeType: string, subfolder?: string }} opts
 * @returns {{ id: string, name: string, viewUrl: string, downloadUrl: string, embedUrl: string }}
 */
export async function uploadFile({ data, filename, mimeType, subfolder = "files" }) {
  await ensureBucket();
  const client = getClient();
  const bucket = getBucket();

  const finalName = `${Date.now()}-${safeName(filename)}`;
  const objectKey  = `${subfolder}/${finalName}`;

  // Convert Buffer to stream if necessary
  const buf = Buffer.isBuffer(data) ? data : await streamToBuffer(data);

  await client.putObject(bucket, objectKey, buf, buf.length, {
    "Content-Type": mimeType || "application/octet-stream"
  });

  const url = await presignedUrl(objectKey);

  return {
    id:          objectKey,   // full key including subfolder prefix
    name:        filename,
    viewUrl:     url,
    downloadUrl: url,
    embedUrl:    url
  };
}

/**
 * Download a file from MinIO by its object key (id returned from uploadFile).
 * @param {string} id — full object key, e.g. "invoices/1700000000-receipt.pdf"
 * @returns {Buffer}
 */
export async function downloadFile(id) {
  await ensureBucket();
  const client = getClient();
  const bucket = getBucket();

  const stream = await client.getObject(bucket, id);
  return streamToBuffer(stream);
}

/**
 * Delete a file from MinIO by its object key.
 * @param {string} id — full object key
 */
export async function deleteFile(id) {
  await ensureBucket();
  const client = getClient();
  const bucket = getBucket();
  await client.removeObject(bucket, id);
}

// ---------------------------------------------------------------------------
// Stream → Buffer utility
// ---------------------------------------------------------------------------
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}
