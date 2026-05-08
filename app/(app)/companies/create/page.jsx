"use client";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyForm } from "@/components/company-form";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";

export default function CreateCompanyPage() {
  const router = useRouter();
  const { refresh, setActive } = useCompany();
  const toast = useToast();

  async function onSubmit(form) {
    try {
      const created = await api("/api/companies", { method: "POST", body: JSON.stringify(form) });
      await refresh();
      setActive(created.id);
      toast({ type: "success", title: "Company created" });
      router.replace("/dashboard");
    } catch (e) {
      toast({ type: "error", title: "Could not create", message: e.message });
    }
  }

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>New Company</CardTitle>
        <CardDescription>Add the GSTIN, PAN, banking and contact details that will appear on every invoice.</CardDescription>
      </CardHeader>
      <CardContent>
        <CompanyForm submitLabel="Create company" onSubmit={onSubmit} />
      </CardContent>
    </Card>
  );
}
