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
import { resolvePostLoginRoute, safeNextPath } from "@/lib/post-login-route";

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const nextPath = safeNextPath(params.get("next"));
  const { user, loading: authLoading, memberships, isPlatformAdmin, isAgent } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [googleHint, setGoogleHint] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    if (nextPath) { window.location.href = nextPath; return; }
    const dest = resolvePostLoginRoute({ memberships, isPlatformAdmin, isAgent });
    navigate(dest, { replace: true });
  }, [authLoading, user, memberships, isPlatformAdmin, isAgent, navigate, nextPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGoogleHint(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      // Detect Google-only accounts: Supabase returns "Invalid login credentials" for
      // users who signed up via OAuth and have no password set. If the email exists in
      // an OAuth identity, guide them to Google instead of a silent 400.
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("invalid login") || msg.includes("invalid_credentials")) {
        setGoogleHint(true);
        return toast({
          title: "Try Google sign-in",
          description: "This email may be registered with Google. Tap Continue with Google.",
        });
      }
      return toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    }
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
          <p className="mt-1 text-sm text-muted-foreground">Most crews sign in with Google — one tap, no password to forget.</p>

          <Button className="mt-6 w-full" onClick={handleGoogle}>
            Continue with Google
          </Button>

          {googleHint && (
            <div className="mt-4 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-foreground">
              That email looks like a Google account. Use <strong>Continue with Google</strong> above.
            </div>
          )}

          {!showEmail ? (
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Sign in with email instead
            </button>
          ) : (
            <>
              <div className="my-6 flex items-center gap-3 text-xs uppercase text-muted-foreground">
                <span className="h-px flex-1 bg-border" />email<span className="h-px flex-1 bg-border" />
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" variant="outline" className="w-full" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in with email"}
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            No account? <Link to="/signup" className="text-primary hover:underline">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
