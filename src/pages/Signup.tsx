import { useEffect, useRef, useState } from "react";
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

const RESEND_COOLDOWN_SECONDS = 45;

export default function Signup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Post-signup "check your email" state (email confirmation is required).
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef<number | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownTimer.current = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => {
      if (cooldownTimer.current) window.clearTimeout(cooldownTimer.current);
    };
  }, [cooldown]);

  const startCooldown = () => setCooldown(RESEND_COOLDOWN_SECONDS);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin + "/onboarding",
      },
    });
    setLoading(false);
    if (error) return toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    trackSignup();

    // If email confirmation is enabled (no session returned), don't route to
    // /onboarding — the user cannot sign in until they click the link. Show a
    // dedicated "check your email" panel instead.
    if (!data.session) {
      setPendingEmail(email);
      startCooldown();
      toast({
        title: "Check your email",
        description: `We sent a confirmation link to ${email}.`,
      });
      return;
    }

    toast({ title: "Account created", description: "Let’s introduce Ava to your company." });
    navigate("/onboarding");
  };

  const handleResend = async () => {
    if (!pendingEmail || cooldown > 0 || resending) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: window.location.origin + "/onboarding" },
    });
    setResending(false);
    if (error) {
      return toast({
        title: "Couldn't resend email",
        description: error.message,
        variant: "destructive",
      });
    }
    startCooldown();
    toast({ title: "Confirmation email sent", description: `Check ${pendingEmail} again.` });
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/login",
    });
    if (result.error) {
      toast({ title: "Google sign-in failed", description: result.error.message, variant: "destructive" });
      return;
    }
    if (result.redirected) return;
    navigate("/onboarding");
  };

  return (
    <div className="min-h-screen bg-gradient-dark">
      <SEO title="Create an account — FastTract" description="Meet your personal FastTract AI assistant and set up your business with five quick answers." path="/signup" noindex />
      <header className="mx-auto max-w-7xl px-4 py-5"><Logo /></header>
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-8 shadow-card">
          {pendingEmail ? (
            <div data-testid="check-email-panel">
              <h1 className="text-2xl font-semibold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to{" "}
                <strong className="text-foreground">{pendingEmail}</strong>. Click the
                link in that email to activate your account, then sign in.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Don't see it? Check your spam folder, or resend below.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-6 w-full"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
              >
                {resending
                  ? "Resending…"
                  : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Resend confirmation email"}
              </Button>
              <div className="mt-6 flex items-center justify-between text-sm">
                <Link to="/login" className="text-primary hover:underline">
                  Back to sign in
                </Link>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setPendingEmail(null);
                    setCooldown(0);
                  }}
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold">Join FastTract</h1>
              <p className="mt-1 text-sm text-muted-foreground">Create your account, set up your company, then choose a 7-day trial plan.</p>
              <Button variant="outline" className="mt-6 w-full" onClick={handleGoogle}>
                Continue with Google
              </Button>
              <div className="my-6 flex items-center gap-3 text-xs uppercase text-muted-foreground">
                <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><Label htmlFor="name">Full name</Label>
                  <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                <div><Label htmlFor="email">Work email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating…" : "Create account & continue"}
                </Button>
              </form>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                You will review pricing before entering payment details.
              </p>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have one? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
