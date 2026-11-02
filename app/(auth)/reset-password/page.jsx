"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", code: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Reset failed");
      router.replace("/login");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>Use the recovery code you saved when you created the account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email">
            <Input type="email" required autoFocus value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Recovery code">
            <Input required placeholder="XXXX-XXXX-XXXX-XXXX" className="font-mono uppercase" value={form.code} onChange={set("code")} />
          </Field>
          <Field label="New password">
            <Input type="password" required minLength={6} value={form.password} onChange={set("password")} />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" disabled={loading} type="submit">{loading ? "Saving…" : "Update password"}</Button>
        </form>
        <div className="mt-4 text-sm text-center">
          <Link href="/login" className="text-primary hover:underline">Back to sign in</Link>
        </div>
      </CardContent>
    </Card>
  );
}
