"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const email = params.get("email") || "";
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, token, password })
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
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>For {email || "your account"}.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="New password">
            <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
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
