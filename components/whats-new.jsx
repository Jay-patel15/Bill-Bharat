"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Thank-you popup after an update: what the new version added. Shown once per version;
 * closing it by any means (button, Escape, backdrop) records the version on the server.
 */
export function WhatsNew() {
  const [info, setInfo] = useState(null);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return; // React runs effects twice in development
    asked.current = true;
    fetch("/api/app/whats-new", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.ok && j.data?.show) setInfo(j.data); })
      .catch(() => {});
  }, []);

  function close() {
    setInfo(null);
    fetch("/api/app/whats-new", { method: "POST" }).catch(() => {});
  }

  return (
    <Dialog
      open={!!info}
      onClose={close}
      title={info ? `Thanks for updating to BillBharat ${info.version}!` : ""}
      size="md"
      footer={<Button onClick={close}>Got it</Button>}
    >
      {info && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" /> New in this version:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {info.items.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
