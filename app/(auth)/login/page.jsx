"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });
      const text = await res.text();
      let json = {};
      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server error (${res.status}). Check Vercel logs or environment variables.`);
      }
      if (!res.ok || !json.ok) throw new Error(json.error || "Login failed");
      const next = params.get("next") || "/dashboard";
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your BillBharat account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email">
            <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Password">
            <Input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
        </div>
        <a href="/api/auth/google" className="block">
          <Button variant="outline" className="w-full" type="button">
            Continue with Google
          </Button>
        </a>

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
          <Link href="/signup" className="text-primary hover:underline">Create account</Link>
        </div>
      </CardContent>
    </Card>
  );
}
