"use client";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ user, children }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-muted/20">
      <Sidebar onLogout={logout} />
      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar user={user} />
        <div className="flex-1 p-5 sm:p-6 max-w-screen-2xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
