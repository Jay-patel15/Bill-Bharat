/**
 * lib/storage/supabase.js — Supabase Storage Adapter
 *
 * Interface:
 *   uploadFile({ data, filename, mimeType, subfolder }) → { id, name, viewUrl, downloadUrl, embedUrl }
 *   downloadFile(id) → Buffer
 *   deleteFile(id) → void
 *
 * Environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL  — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service-role key (server-side only, bypasses RLS)
 *   SUPABASE_STORAGE_BUCKET   — bucket name (default: "billbharat-storage"), must be public
 *
 * Files are stored at: <bucket>/<subfolder>/<timestamp>-<filename>
 */

import { createClient } from "@supabase/supabase-js";

let _client = null;

function getClient() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.");
  }
  _client = createClient(url, key);
  return _client;
}

function getBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || "billbharat-storage";
}

function safeName(name) {
  return (name || `file-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadFile({ data, filename, mimeType, subfolder = "files" }) {
  const client = getClient();
  const bucket = getBucket();

  const objectKey = `${subfolder}/${Date.now()}-${safeName(filename)}`;

  const { error } = await client.storage.from(bucket).upload(objectKey, data, {
    contentType: mimeType || "application/octet-stream"
  });
  if (error) throw new Error(`Supabase Storage upload error: ${error.message}`);

  const { data: pub } = client.storage.from(bucket).getPublicUrl(objectKey);

  return {
    id: objectKey,
    name: filename,
    viewUrl: pub.publicUrl,
    downloadUrl: pub.publicUrl,
    embedUrl: pub.publicUrl
  };
}

export async function downloadFile(id) {
  const client = getClient();
  const bucket = getBucket();

  const { data, error } = await client.storage.from(bucket).download(id);
  if (error) throw new Error(`Supabase Storage download error: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteFile(id) {
  const client = getClient();
  const bucket = getBucket();

  const { error } = await client.storage.from(bucket).remove([id]);
  if (error) throw new Error(`Supabase Storage delete error: ${error.message}`);
}
