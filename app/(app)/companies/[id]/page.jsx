"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyForm } from "@/components/company-form";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";

export default function EditCompanyPage({ params }) {
  const router = useRouter();
  const { refresh } = useCompany();
  const toast = useToast();
  const [company, setCompany] = useState(null);

  useEffect(() => {
    api(`/api/companies/${params.id}`).then(setCompany).catch(() => router.replace("/companies"));
  }, [params.id]);

  async function onSubmit(form) {
    try {
      await api(`/api/companies/${params.id}`, { method: "PUT", body: JSON.stringify(form) });
      await refresh();
      toast({ type: "success", title: "Saved" });
      router.replace("/companies");
    } catch (e) {
      toast({ type: "error", title: "Save failed", message: e.message });
    }
  }

  if (!company) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>Edit company</CardTitle>
      </CardHeader>
      <CardContent>
        <CompanyForm initial={company} submitLabel="Save changes" onSubmit={onSubmit} />
      </CardContent>
    </Card>
  );
}
