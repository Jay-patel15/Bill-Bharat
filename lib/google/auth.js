import { google } from "googleapis";

let cachedAuth = null;

function loadCredentials() {
  if (process.env.GOOGLE_CREDENTIALS_BASE64?.trim()) {
    const json = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, "base64").toString("utf8");
    if (json.trim()) return JSON.parse(json);
  }
  if (process.env.GOOGLE_CREDENTIALS_JSON?.trim()) {
    return JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  }
  throw new Error(
    "Google service account credentials missing. Set GOOGLE_CREDENTIALS_JSON or GOOGLE_CREDENTIALS_BASE64."
  );
}

export function getGoogleAuth() {
  if (cachedAuth) return cachedAuth;
  const creds = loadCredentials();
  cachedAuth = new google.auth.GoogleAuth({
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key.replace(/\\n/g, "\n")
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive"
    ]
  });
  return cachedAuth;
}

export function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getGoogleAuth() });
}

export function getDriveClient() {
  return google.drive({ version: "v3", auth: getGoogleAuth() });
}

export function getServiceAccountEmail() {
  const creds = loadCredentials();
  return creds.client_email;
}
