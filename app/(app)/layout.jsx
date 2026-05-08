import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { findWhere } from "@/lib/google/sheets";
import { CompanyProvider } from "@/components/company-context";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let companies = [];
  try {
    companies = await findWhere("companies", (c) => c.userId === user.id);
  } catch {
    // Sheets not configured (dev preview) — render shell with no companies.
  }
  return (
    <ToastProvider>
      <CompanyProvider initialCompanies={companies}>
        <AppShell user={user}>{children}</AppShell>
      </CompanyProvider>
    </ToastProvider>
  );
}
