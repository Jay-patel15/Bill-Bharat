import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/toast";

export default async function AuthLayout({ children }) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <ToastProvider>
      <div className="min-h-screen grid lg:grid-cols-2">
        <aside className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-slate-900 to-slate-700 text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded bg-white text-slate-900 grid place-items-center font-bold">B</div>
            <div className="text-2xl font-semibold">BillBharat</div>
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold leading-tight">
              GST invoicing, inventory & finance — built for Indian businesses.
            </h2>
            <ul className="space-y-2 text-slate-200 text-sm">
              <li>✓ Multi-company GSTIN support (CGST/SGST/IGST)</li>
              <li>✓ Auto-PDF invoices with bank details & T&C</li>
              <li>✓ AI reads purchase PDFs and updates inventory</li>
              <li>✓ Google Sheets + Drive backend — your data, your storage</li>
            </ul>
          </div>
          <div className="text-xs text-slate-400">© {new Date().getFullYear()} BillBharat</div>
        </aside>
        <main className="flex items-center justify-center p-6">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
