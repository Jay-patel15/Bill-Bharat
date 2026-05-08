"use client";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PurchaseForm } from "@/components/purchase-form";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";
import { NoCompanySelected } from "@/components/empty-state";

export default function CreatePurchasePage() {
  const router = useRouter();
  const { active } = useCompany();
  const toast = useToast();

  if (!active) return <NoCompanySelected />;

  async function onSubmit(form) {
    try {
      await api("/api/purchases", { method: "POST", body: JSON.stringify(form) });
      toast({ type: "success", title: "Purchase recorded" });
      router.replace("/purchase");
    } catch (e) {
      toast({ type: "error", title: "Save failed", message: e.message });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New Purchase</h1>
      <PurchaseForm onSubmit={onSubmit} submitLabel="Record purchase" />
    </div>
  );
}
