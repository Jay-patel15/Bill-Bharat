"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Settings, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, useCompany } from "@/components/company-context";
import { NoCompanySelected } from "@/components/empty-state";

export default function SettingsPage() {
  const { active } = useCompany();
  const [mappings, setMappings] = useState([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (active?.id) {
      setLoading(true);
      api("/api/product-mappings")
        .then(setMappings)
        .catch(() => setMappings([]))
        .finally(() => setLoading(false));
    }
  }, [active?.id]);

  if (!active) return <NoCompanySelected />;

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const added = await api("/api/product-mappings", {
        method: "POST",
        body: JSON.stringify({ realName: newName.trim() })
      });
      setMappings((prev) => [...prev, added]);
      setNewName("");
    } catch (err) {
      alert(err.message || "Failed to add mapping");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Remove this product name?")) return;
    try {
      await api(`/api/product-mappings/${id}`, { method: "DELETE" });
      setMappings((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      alert(err.message || "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Product Master Names</CardTitle>
            <p className="text-sm text-muted-foreground">
              Define the "Real Product Names" here. You can map vendor item names to these master names during AI upload to avoid duplicates.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAdd} className="flex gap-2">
              <Input
                placeholder="e.g. Cement 50kg"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={saving}
              />
              <Button type="submit" disabled={saving || !newName.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Add Name
              </Button>
            </form>

            <div className="rounded-md border divide-y">
              {loading ? (
                <div className="p-4 text-sm text-center text-muted-foreground">Loading...</div>
              ) : mappings.length === 0 ? (
                <div className="p-4 text-sm text-center text-muted-foreground">No product names added yet.</div>
              ) : (
                mappings.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                    <span className="font-medium">{m.realName}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
