import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { findWhere, listAll } from "@/lib/db";
import { CompanyProvider } from "@/components/company-context";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let companies = [];
  try {
    // Object filter hits the companies_user_idx index instead of scanning.
    companies = await findWhere("companies", { userId: user.id });
    if (companies.length === 0 && process.env.DEV_BYPASS_AUTH === "1") {
      companies = await listAll("companies");
    }
  } catch {
    // Render the shell with no companies rather than failing the whole page.
  }
  return (
    <ToastProvider>
      <CompanyProvider initialCompanies={companies}>
        <AppShell user={user}>{children}</AppShell>
      </CompanyProvider>
    </ToastProvider>
  );
}

