"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DatabaseBackup, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/components/company-context";
import { formatDate } from "@/lib/utils";

const WEEK = 7 * 24 * 3600 * 1000;

/** No copy outside this PC's data folder for 7 days, or the last copy failed. */
const needsAttention = (st) => st && (!st.folders.length || !st.lastOffsite || Date.now() - Date.parse(st.lastOffsite) > WEEK || Boolean(st.lastOffsiteError));

/**
 * Backup & restore: download a backup, restore one, and choose extra backup
 * folders (Google Drive / OneDrive / Dropbox folder, USB, other drive, network
 * share). Every backup, including the automatic daily one, is copied to each.
 */
export function BackupCard() {
  const toast = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [st, setSt] = useState(null);
  const [folders, setFolders] = useState("");

  useEffect(() => {
    api("/api/backup/settings").then((s) => { setSt(s); setFolders(s.folders.join("\n")); }).catch(() => {});
  }, []);

  async function run(label, fn) {
    setBusy(true);
    try { setSt(await fn()); toast({ type: "success", title: label }); }
    catch (err) { toast({ type: "error", title: "Backup failed", message: err.message }); }
    finally { setBusy(false); }
  }

  const saveFolders = () => run("Backup folders saved and backed up", () =>
    api("/api/backup/settings", { method: "PUT", body: JSON.stringify({ folders: folders.split("\n") }) }));
  const backupNow = () => run("Backed up", () => api("/api/backup/settings", { method: "POST" }));

  async function restore(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!confirm(`Replace ALL current books with "${file.name}"?\nA copy of the current books is saved in the backups folder first.`)) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/backup/restore", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Restore failed");
      toast({ type: "success", title: "Books restored" });
      window.location.reload();
    } catch (err) {
      toast({ type: "error", title: "Restore failed", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-2 border-transparent bg-card">
      <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
        <div className="rounded-lg bg-primary/10 p-3">
          <DatabaseBackup className="h-6 w-6 text-primary" />
        </div>
        <div>
          <CardTitle className="text-lg font-bold">Backup &amp; Restore</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">All companies, books, logo and uploaded bills in one file.</p>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Backed up automatically every day and before every update (last 30 of each kind are kept).
          {st && <> Last daily backup: <b>{st.lastDaily ? formatDate(st.lastDaily) : "none yet"}</b>. Saved in <span className="font-mono text-xs">{st.localDir}</span>.</>}
        </p>

        <label className="block text-sm space-y-1">
          <span className="font-medium">Extra backup folders (one per line, up to 5)</span>
          <Textarea rows={3} className="font-mono text-xs" value={folders} onChange={(e) => setFolders(e.target.value)}
            placeholder={"G:\\My Drive\\BillBharat Backups\nE:\\BillBharat\n\\\\OFFICE-PC\\Backups\\BillBharat"} />
          <span className="block text-xs text-muted-foreground">
            Use a folder that is not on C: so a Windows reset cannot take it. For cloud backup install Google Drive for desktop,
            OneDrive or Dropbox and give its folder here (e.g. <span className="font-mono">G:\My Drive\…</span>); it uploads every copy by itself.
            A pen drive, another disk or a shared network folder works too. A shared Drive link cannot be used directly.
          </span>
        </label>
        {st && (st.folders.length > 0) && (
          <p className={`text-xs ${st.lastOffsiteError ? "text-destructive" : "text-muted-foreground"}`}>
            Last copy to these folders: {st.lastOffsite ? new Date(st.lastOffsite).toLocaleString() : "never"}
            {st.lastOffsiteError && <> · Failed: {st.lastOffsiteError} (pen drive unplugged or folder offline?)</>}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={saveFolders}>Save folders</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={backupNow}>Back up now</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => { window.location.href = "/api/backup"; }}>Download a copy</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Working…" : "Restore from file…"}
          </Button>
          <input ref={fileRef} type="file" accept=".db" className="hidden" onChange={restore} />
        </div>
      </CardContent>
    </Card>
  );
}

/** App-wide: checks backups on open and hourly (taking the daily one), warns when nothing has left this PC for a week. */
export function BackupReminder() {
  const [st, setSt] = useState(null);
  useEffect(() => {
    const check = () => api("/api/backup/settings").then(setSt).catch(() => {});
    check();
    const t = setInterval(check, 3600 * 1000);
    return () => clearInterval(t);
  }, []);
  if (!needsAttention(st)) return null;
  return (
    <div role="alert" className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
      <TriangleAlert className="h-4 w-4 shrink-0" />
      <span>
        {st.lastOffsiteError ? `Last backup copy failed: ${st.lastOffsiteError}.`
          : !st.folders.length ? "Your backups are only on this PC. If Windows or the drive is reset they are lost."
          : "No backup has reached your backup folders for 7 days."}
      </span>
      <Link href="/settings" className="font-semibold underline">Set up backup folder</Link>
    </div>
  );
}

/** Erase all books (factory reset). Needs the login password; a full backup is taken first. */
export function ResetCard() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function erase(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/settings/reset", { method: "POST", body: JSON.stringify({ password }) });
      window.localStorage.removeItem("bb.activeCompanyId");
      toast({ type: "success", title: "All books erased", message: "A backup was saved first; use Restore to undo." });
      window.location.href = "/dashboard";
    } catch (err) {
      toast({ type: "error", title: "Not erased", message: err.message });
      setBusy(false);
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-2"><CardTitle className="text-lg font-bold text-destructive">Reset (erase all books)</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Deletes every company with its customers, items, invoices, purchases, payments, logo and uploaded bills.
          Your login stays. A full backup is saved first, so <b>Restore from file…</b> can bring it all back.
        </p>
        <Button size="sm" variant="outline" className="border-destructive text-destructive" onClick={() => { setPassword(""); setOpen(true); }}>
          Reset all books…
        </Button>
        <Dialog open={open} onClose={() => !busy && setOpen(false)} title="Erase all books?">
          <form onSubmit={erase} className="space-y-3">
            <p className="text-sm">Type your login password to confirm. This erases <b>all companies</b> on this PC.</p>
            <Input type="password" autoFocus required autoComplete="current-password" aria-label="Login password"
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Login password" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy || !password} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {busy ? "Erasing…" : "Erase all books"}
              </Button>
            </div>
          </form>
        </Dialog>
      </CardContent>
    </Card>
  );
}
