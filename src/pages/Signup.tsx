import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { trackSignup } from "@/lib/gtag";

export default function Signup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: window.location.origin + "/onboarding",
      },
    });

    setLoading(false);

    if (error) {
      return toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    }

    trackSignup();

    if (!data.session) {
      toast({
        title: "Check your email",
        description: "Confirm your email address, then sign in to finish setting up your company.",
      });
      navigate("/login", { replace: true });
      return;
    }

    toast({ title: "Account created", description: "Let's set up your company." });
    navigate("/onboarding", { replace: true });
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/login",
    });

    if (result.error) {
      toast({
        title: "Google sign-in failed",
        description: result.error.message,
        variant: "destructive",
      });
      return;
    }

    if (result.redirected) return;
    navigate("/onboarding", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-dark">
      <SEO
        title="Create an account — FastTract"
        description="Create your FastTract account and set up your contracting business in minutes."
        path="/signup"
        noindex
      />
      <header className="mx-auto max-w-7xl px-4 py-5"><Logo /></header>
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-8 shadow-card">
          <h1 className="text-2xl font-semibold">Start running your business with FastTract</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your account now. Set up your company first, then choose the plan that fits your crew.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
            No charge at signup. Your trial begins only after you select a plan.
          </div>
          <Button variant="outline" className="mt-6 w-full" onClick={handleGoogle} disabled={loading}>
            Continue with Google
          </Button>
          <div className="my-6 flex items-center gap-3 text-xs uppercase text-muted-foreground">
            <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">Use at least 8 characters.</p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating…" : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            By continuing, you agree to the <Link to="/terms" className="hover:text-foreground hover:underline">Terms</Link> and <Link to="/privacy" className="hover:text-foreground hover:underline">Privacy Notice</Link>.
          </p>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
