"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { KeyboardShortcuts, VOUCHER_KEYS } from "./keyboard-shortcuts";
import { QuickCreate } from "./quick-create";
import { BackupReminder } from "./backup-card";

export function AppShell({ user, children }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-muted/20">
      <Sidebar onLogout={logout} open={menuOpen} onClose={closeMenu} />
      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar user={user} menuOpen={menuOpen} onMenu={() => setMenuOpen((s) => !s)} />
        <BackupReminder />
        <div className="flex-1 min-h-0 p-4 sm:p-5 max-w-screen-2xl w-full mx-auto overflow-x-auto">
          {children}
        </div>
        <footer className="hidden md:flex sticky bottom-0 border-t bg-background/95 px-4 py-1 text-[11px] text-muted-foreground flex-wrap gap-x-4 gap-y-0.5">
          {Object.entries(VOUCHER_KEYS).map(([k, v]) => <span key={k}><kbd className="font-semibold text-foreground">{k}</kbd> {v.label}</span>)}
          <span><kbd className="font-semibold text-foreground">Alt+A</kbd> Accept</span>
          <span><kbd className="font-semibold text-foreground">Alt+C</kbd> Create</span>
          <span><kbd className="font-semibold text-foreground">F2</kbd> Date</span>
          <span><kbd className="font-semibold text-foreground">Enter</kbd> Next field</span>
          <span><kbd className="font-semibold text-foreground">Esc</kbd> Back</span>
        </footer>
        <KeyboardShortcuts />
        <QuickCreate />
      </main>
    </div>
  );
}
