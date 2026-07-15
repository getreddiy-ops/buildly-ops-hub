import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rawNext = params.get("next");
  const nextPath = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;
  const { user, loading: authLoading, memberships, isPlatformAdmin, isAgent } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // If a signed-in user lands on /login, send them to the right home instead of trapping them here.
  useEffect(() => {
    if (authLoading || !user) return;
    if (nextPath) { window.location.href = nextPath; return; }
    if (memberships.length > 0) navigate("/app", { replace: true });
    else if (isPlatformAdmin) navigate("/admin", { replace: true });
    else if (isAgent) navigate("/agent", { replace: true });
    else navigate("/onboarding", { replace: true });
  }, [authLoading, user, memberships, isPlatformAdmin, isAgent, navigate, nextPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    if (nextPath) { window.location.href = nextPath; return; }
    navigate("/app");
  };

  const handleGoogle = async () => {
    const redirectTarget = nextPath
      ? window.location.origin + "/login?next=" + encodeURIComponent(nextPath)
      : window.location.origin + "/login";
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: redirectTarget,
    });
    if (result.error) {
      toast({ title: "Google sign-in failed", description: result.error.message, variant: "destructive" });
      return;
    }
    if (result.redirected) return;
    if (nextPath) { window.location.href = nextPath; return; }
    navigate("/app");
  };

  return (
    <div className="min-h-screen bg-gradient-dark">
      <SEO title="Sign in — FastTract" description="Sign in to your FastTract account to manage leads, jobs, crew, and time tracking." path="/login" noindex />
      <header className="mx-auto max-w-7xl px-4 py-5"><Logo /></header>
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-8 shadow-card">
          <h1 className="text-2xl font-semibold">Sign in to FastTract</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your FastTract account.</p>
          <Button variant="outline" className="mt-6 w-full" onClick={handleGoogle}>
            Continue with Google
          </Button>
          <div className="my-6 flex items-center gap-3 text-xs uppercase text-muted-foreground">
            <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            No account? <Link to="/signup" className="text-primary hover:underline">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
