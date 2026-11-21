"use client";
import { useEffect, useRef, useState } from "react";
import { Printer, Save } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Save a PDF where the user picks. Desktop app: the native Save As dialog. Browsers that
 * support it: the browser's own save picker. Anything else: a normal download.
 * Resolves { saved: false } when the user cancels.
 */
export async function savePdf(blob, name) {
  const safe = String(name || "document.pdf").replace(/[\\/:*?"<>|]/g, "-");
  if (window.billbharatDesktop?.savePdf) {
    return window.billbharatDesktop.savePdf(safe, await blob.arrayBuffer());
  }
  if (window.showSaveFilePicker) {
    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: safe,
        types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }]
      });
    } catch (e) {
      if (e.name === "AbortError") return { saved: false };
      throw e;
    }
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { saved: true };
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safe;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { saved: true };
}

/**
 * Print preview for any PDF the app builds. `src` is the PDF URL; set it to null to close.
 * Shows the PDF first; the user then prints it or saves it to a place they choose.
 */
export function PdfPreview({ src, fileName, onClose }) {
  const toast = useToast();
  const [blob, setBlob] = useState(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const frame = useRef(null);

  useEffect(() => {
    if (!src) { setBlob(null); setUrl(""); setError(""); return; }
    let alive = true;
    setBlob(null); setUrl(""); setError("");
    fetch(src)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Could not build the PDF");
        }
        return res.blob();
      })
      .then((b) => { if (alive) { setBlob(b); setUrl(URL.createObjectURL(b)); } })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [src]);

  // Free each preview's object URL when it is replaced or the dialog unmounts.
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  function print() {
    const win = frame.current?.contentWindow;
    if (!win) return toast({ type: "error", title: "Preview not ready", message: "Wait for the PDF to appear." });
    win.focus();
    win.print();
  }

  async function save() {
    try {
      const r = await savePdf(blob, fileName);
      if (r.saved) toast({ type: "success", title: "PDF saved", message: r.path || fileName });
    } catch (e) {
      toast({ type: "error", title: "Could not save PDF", message: e.message });
    }
  }

  return (
    <Dialog
      open={!!src}
      onClose={onClose}
      title={`Print preview — ${fileName || "PDF"}`}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="outline" onClick={save} disabled={!blob}><Save className="h-4 w-4" /> Save as…</Button>
          <Button onClick={print} disabled={!blob}><Printer className="h-4 w-4" /> Print</Button>
        </>
      }
    >
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !url ? (
        <p className="text-sm text-muted-foreground">Preparing preview…</p>
      ) : (
        <iframe ref={frame} src={url} title="PDF preview" className="w-full h-[65vh] rounded border bg-muted" />
      )}
    </Dialog>
  );
}
