"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Signup failed");
      setCode(json.data.recoveryCode);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  if (code) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Save your recovery code</CardTitle>
          <CardDescription>
            It is the only way to reset your password. Write it down or print it and keep it away from this computer. It will not be shown again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="select-all rounded border bg-muted p-3 text-center font-mono text-lg tracking-widest">{code}</p>
          <Button className="w-full" autoFocus onClick={() => { router.replace("/companies/create"); router.refresh(); }}>
            I have saved it, continue
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Start invoicing in under 2 minutes.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Full name">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Password" hint="Minimum 6 characters.">
            <Input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <div className="mt-4 text-sm text-center">
          Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </div>
      </CardContent>
    </Card>
  );
}
