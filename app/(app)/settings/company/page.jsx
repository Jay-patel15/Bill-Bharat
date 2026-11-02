"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyForm } from "@/components/company-form";
import { api, useCompany } from "@/components/company-context";
import { NoCompanySelected } from "@/components/empty-state";
import { useToast } from "@/components/ui/toast";

/** Settings → Company details: edit the active company (name, GSTIN, address, logo, bank, terms). */
export default function CompanyDetailsPage() {
  const { active, refresh } = useCompany();
  const toast = useToast();
  const [company, setCompany] = useState(null);

  useEffect(() => {
    if (!active?.id) return;
    setCompany(null);
    api(`/api/companies/${active.id}`).then(setCompany).catch((e) => toast({ type: "error", title: e.message }));
  }, [active?.id]);

  async function onSubmit(form) {
    try {
      const saved = await api(`/api/companies/${active.id}`, { method: "PUT", body: JSON.stringify(form) });
      setCompany(saved);
      await refresh();
      toast({ type: "success", title: "Company details saved", message: "New invoices use them straight away." });
    } catch (e) {
      toast({ type: "error", title: "Save failed", message: e.message });
    }
  }

  if (!active) return <NoCompanySelected />;

  return (
    <div className="space-y-3 max-w-4xl">
      <div className="flex items-center gap-2">
        <Link href="/settings"><Button variant="ghost" size="icon" aria-label="Back to settings"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-xl font-semibold">Company details</h1>
          <p className="text-xs text-muted-foreground">Name, GSTIN, PAN, address, contacts, logo, bank and terms printed on invoices.</p>
        </div>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{company?.name || active.name}</CardTitle></CardHeader>
        <CardContent>
          {company
            ? <CompanyForm key={company.id} initial={company} submitLabel="Save company details" onSubmit={onSubmit} />
            : <p className="text-sm text-muted-foreground">Loading…</p>}
        </CardContent>
      </Card>
    </div>
  );
}
