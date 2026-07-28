import { importPKCS8, SignJWT } from "jose";

/**
 * Get an OAuth2 access token from Google Service Account credentials.
 */
export async function getGoogleAccessToken() {
  const credsJson = process.env.GOOGLE_CREDENTIALS_JSON || 
    (process.env.GOOGLE_CREDENTIALS_BASE64 ? Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, "base64").toString("utf8") : null);

  if (!credsJson?.trim()) {
    throw new Error("GOOGLE_CREDENTIALS_JSON or GOOGLE_CREDENTIALS_BASE64 is not set in .env");
  }

  const creds = JSON.parse(credsJson);
  const privateKeyPem = creds.private_key;
  const clientEmail = creds.client_email;

  if (!privateKeyPem || !clientEmail) {
    throw new Error("Invalid service account JSON: private_key or client_email is missing");
  }

  const alg = "RS256";
  const privateKey = await importPKCS8(privateKeyPem, alg);

  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive"
  })
    .setProtectedHeader({ alg, typ: "JWT" })
    .setIssuer(clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setExpirationTime(now + 3600)
    .setIssuedAt(now)
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google OAuth error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Upload a PDF file buffer to Google Drive folder.
 * @param {Buffer|Uint8Array} fileBuffer 
 * @param {string} fileName 
 * @param {string} mimeType 
 * @returns {Promise<{ fileId: string, webViewLink: string }>}
 */
export async function uploadToGoogleDrive(fileBuffer, fileName, mimeType = "application/pdf") {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  const accessToken = await getGoogleAccessToken();

  const metadata = {
    name: fileName,
    parents: folderId ? [folderId] : []
  };

  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  const buf = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);

  const bodyParts = [
    delimiter,
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    JSON.stringify(metadata),
    delimiter,
    `Content-Type: ${mimeType}\r\n`,
    "Content-Transfer-Encoding: base64\r\n\r\n",
    buf.toString("base64"),
    closeDelim
  ];

  const multipartRequestBody = bodyParts.join("");

  const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive upload failed (${uploadRes.status}): ${errText}`);
  }

  const fileData = await uploadRes.json();
  const driveUrl = fileData.webViewLink || `https://drive.google.com/file/d/${fileData.id}/view`;

  return {
    fileId: fileData.id,
    webViewLink: driveUrl,
    viewUrl: driveUrl
  };
}
