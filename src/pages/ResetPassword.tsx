import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostLoginRoute } from "@/lib/post-login-route";
import { toast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { user, loading, memberships, isPlatformAdmin, isAgent } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (password.length < 8) {
      setFormError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("The passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    } catch {
      toast({
        title: "Couldn't update your password",
        description: "Your reset link may have expired. Request a new one and try again.",
        variant: "destructive",
      });
      return;
    } finally {
      setSaving(false);
    }

    toast({ title: "Password updated", description: "You're signed in with your new password." });
    const destination = resolvePostLoginRoute({ memberships, isPlatformAdmin, isAgent });
    navigate(destination, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-dark">
      <SEO title="Reset password — FastTract" description="Set a new password for your FastTract account." path="/reset-password" noindex />
      <header className="mx-auto max-w-7xl px-4 py-5"><Logo /></header>
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-8 shadow-card">
          <h1 className="text-2xl font-semibold">Set a new password</h1>
          {loading ? (
            <p role="status" className="mt-4 text-sm text-muted-foreground">Verifying your reset link…</p>
          ) : !user ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">This reset link is invalid or has expired. Request a new link and check your email.</p>
              <Button asChild className="w-full"><Link to="/login">Return to sign in</Link></Button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">Choose a new password for {user.email}.</p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="new-password">New password</Label>
                  <Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                </div>
                {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Updating password…" : "Update password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
