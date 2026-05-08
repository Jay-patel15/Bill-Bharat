"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, useCompany } from "@/components/company-context";
import { useToast } from "@/components/ui/toast";

export default function CompaniesListPage() {
  const { companies, refresh } = useCompany();
  const toast = useToast();
  const [list, setList] = useState(companies);

  useEffect(() => { setList(companies); }, [companies]);

  async function onDelete(c) {
    if (!confirm(`Delete company "${c.name}"? This cannot be undone.`)) return;
    try {
      await api(`/api/companies/${c.id}`, { method: "DELETE" });
      await refresh();
      toast({ type: "success", title: "Company deleted" });
    } catch (e) {
      toast({ type: "error", title: "Delete failed", message: e.message });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Companies</h1>
          <p className="text-sm text-muted-foreground">Manage your business entities and switch between them.</p>
        </div>
        <Link href="/companies/create">
          <Button><Plus className="h-4 w-4" /> New company</Button>
        </Link>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-muted-foreground mb-4">You haven't created a company yet.</p>
            <Link href="/companies/create"><Button>Create your first company</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{c.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-muted-foreground">{c.gstNumber || "No GSTIN"}</div>
                <div className="truncate">{c.address || "—"}</div>
                <div className="flex justify-end gap-2 pt-3">
                  <Link href={`/companies/${c.id}`}>
                    <Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  </Link>
                  <Button size="sm" variant="destructive" onClick={() => onDelete(c)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
