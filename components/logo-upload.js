"use client";

/**
 * Upload a company logo. Any image the browser can show (PNG, JPEG, WebP, GIF,
 * SVG…) is redrawn to PNG first, because the invoice PDF can only embed PNG or
 * JPEG. Large images are scaled down to 600 px so invoices stay small.
 * Returns the stored file URL (/api/files/logos/…).
 */
export async function uploadLogo(file) {
  if (!file?.type?.startsWith("image/")) throw new Error("Choose an image file for the logo");
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("This image could not be read"));
      i.src = src;
    });
    const scale = Math.min(1, 600 / Math.max(img.naturalWidth || 600, img.naturalHeight || 600));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((img.naturalWidth || 600) * scale));
    canvas.height = Math.max(1, Math.round((img.naturalHeight || 600) * scale));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

    const fd = new FormData();
    fd.append("file", png, `${(file.name || "logo").replace(/\.[^.]+$/, "")}.png`);
    fd.append("subfolder", "logos");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || "Logo upload failed");
    return json.data.viewUrl;
  } finally {
    URL.revokeObjectURL(src);
  }
}
