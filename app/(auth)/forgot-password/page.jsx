"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email })
      });
      const json = await res.json();
      setSent(true);
      if (json.data?.resetUrl) setResetUrl(json.data.resetUrl);
    } finally { setLoading(false); }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>We'll generate a reset link for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        {sent ? (
          <div className="mt-4 p-3 rounded border bg-muted text-sm">
            If an account exists for <strong>{email}</strong>, a reset link has been generated.
            {resetUrl ? (
              <div className="mt-2 break-all">
                <Link href={resetUrl} className="text-primary underline">{resetUrl}</Link>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 text-sm text-center">
          <Link href="/login" className="text-primary hover:underline">Back to sign in</Link>
        </div>
      </CardContent>
    </Card>
  );
}
