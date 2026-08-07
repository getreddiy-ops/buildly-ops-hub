import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <SEO title="Reset your password | FastTract" description="Request a password reset link for your FastTract account." />
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      {sent ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way.
            Check your inbox and spam folder.
          </p>
          <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
            Send to a different email
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and we'll send you a link to set a new password.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
      </p>
    </main>
  );
}
