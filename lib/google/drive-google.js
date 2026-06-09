/**
 * lib/google/drive-google.js — Google Drive backend implementation
 *
 * This module is lazy-loaded by lib/google/drive.js only when
 * STORAGE_BACKEND=drive (or auto-detected). It is NOT imported at module
 * load time, so googleapics is not required when using MinIO or local storage.
 */

import { Readable } from "stream";
import { getDriveClient } from "./auth.js";

const ROOT_FOLDER = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function ensureSubfolder(name) {
  const drive = getDriveClient();
  const q = [
    `'${ROOT_FOLDER}' in parents`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `name = '${name.replace(/'/g, "\\'")}'`,
    "trashed = false"
  ].join(" and ");
  const res = await drive.files.list({ q, fields: "files(id,name)" });
  if (res.data.files.length) return res.data.files[0].id;
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [ROOT_FOLDER]
    },
    fields: "id"
  });
  return created.data.id;
}

export async function driveUploadFile({ data, filename, mimeType, subfolder = "files", makePublic = true }) {
  if (!ROOT_FOLDER) throw new Error("GOOGLE_DRIVE_FOLDER_ID not set");
  const drive = getDriveClient();
  const parentId = await ensureSubfolder(subfolder);
  const stream = Buffer.isBuffer(data) ? Readable.from(data) : data;
  const file = await drive.files.create({
    requestBody: { name: filename, parents: [parentId] },
    media: { mimeType, body: stream },
    fields: "id, name, webViewLink, webContentLink"
  });
  if (makePublic) {
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: { role: "reader", type: "anyone" }
    });
  }
  return {
    id:          file.data.id,
    name:        file.data.name,
    viewUrl:     file.data.webViewLink,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${file.data.id}`,
    embedUrl:    `https://drive.google.com/file/d/${file.data.id}/preview`
  };
}

export async function driveDownloadFile(fileId) {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data);
}

export async function driveDeleteFile(fileId) {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
}
