import { useEffect, useRef, useState } from "react";
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
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownTimer = useRef<number | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    cooldownTimer.current = window.setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => {
      if (cooldownTimer.current) window.clearTimeout(cooldownTimer.current);
    };
  }, [resendCooldown]);

  const handleResendConfirmation = async () => {
    if (!email || resending || resendCooldown > 0) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin + "/onboarding" },
    });
    setResending(false);
    if (error) {
      return toast({ title: "Couldn't resend email", description: error.message, variant: "destructive" });
    }
    setResendCooldown(45);
    toast({ title: "Confirmation email sent", description: `Check ${email}.` });
  };

  useEffect(() => {
    if (authLoading || !user) return;
    if (nextPath) { window.location.href = nextPath; return; }
    const dest = resolvePostLoginRoute({ memberships, isPlatformAdmin, isAgent });
    // Hard nav as fallback: some preview/iframe scenarios silently swallow
    // client-side navigate() right after OAuth returns.
    navigate(dest, { replace: true });
    const t = setTimeout(() => {
      if (window.location.pathname === "/login") window.location.replace(dest);
    }, 400);
    return () => clearTimeout(t);
  }, [authLoading, user, memberships, isPlatformAdmin, isAgent, navigate, nextPath]);

  const authedDest = user
    ? resolvePostLoginRoute({ memberships, isPlatformAdmin, isAgent })
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGoogleHint(false);
    setUnconfirmed(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("not confirmed") || msg.includes("email_not_confirmed") || msg.includes("confirm your email")) {
        setUnconfirmed(true);
        return toast({
          title: "Email not confirmed",
          description: "Click the confirmation link we emailed you, or resend it below.",
          variant: "destructive",
        });
      }
      // Detect Google-only accounts: Supabase returns "Invalid login credentials" for
      // users who signed up via OAuth and have no password set.
      if (msg.includes("invalid login") || msg.includes("invalid_credentials")) {
        setGoogleHint(true);
        return toast({
          title: "Check your credentials",
          description: "If you signed up with Google, use Continue with Google. If you signed up with email, make sure you've confirmed it.",
        });
      }
      return toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    }
    // Post-auth routing is centralized in the useEffect above (fires when the
    // session + memberships load). This keeps workers → /field, admins → /admin,
    // agents → /agent, and unenrolled users → /onboarding.
    if (nextPath) { window.location.href = nextPath; return; }
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
    // Popup path: useEffect routes by role once memberships load.
    if (nextPath) window.location.href = nextPath;
  };

  return (
    <div className="min-h-screen bg-gradient-dark">
      <SEO title="Sign in — FastTract" description="Sign in to your FastTract account to manage leads, jobs, crew, and time tracking." path="/login" noindex />
      <header className="mx-auto max-w-7xl px-4 py-5"><Logo /></header>
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-8 shadow-card">
          <h1 className="text-2xl font-semibold">Sign in to FastTract</h1>
          <p className="mt-1 text-sm text-muted-foreground">Most crews sign in with Google — one tap, no password to forget.</p>

          {user && authedDest && (
            <div className="mt-4 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
              You're already signed in as <strong>{user.email}</strong>.{" "}
              <a href={authedDest} className="font-semibold text-primary underline">
                Continue →
              </a>
            </div>
          )}

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
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
                  </div>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" variant="outline" className="w-full" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in with email"}
                </Button>
              </form>
              {unconfirmed && (
                <div data-testid="unconfirmed-notice" className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
                  Your email isn't confirmed yet. Check your inbox for the FastTract
                  confirmation link, then sign in.
                </div>
              )}
              <div className="mt-4 text-center text-xs text-muted-foreground">
                Didn't receive your confirmation email?{" "}
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={!email || resending || resendCooldown > 0}
                  className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {resending
                    ? "Resending…"
                    : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend it"}
                </button>
              </div>
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
