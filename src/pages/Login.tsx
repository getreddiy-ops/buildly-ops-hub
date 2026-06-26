import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    navigate("/app");
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast({ title: "Google sign-in failed", description: result.error.message, variant: "destructive" });
      return;
    }
    if (result.redirected) return;
    navigate("/app");
  };

  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="mx-auto max-w-7xl px-4 py-5"><Logo /></header>
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-8 shadow-card">
          <h1 className="text-2xl font-semibold">Sign in to Contractor OS</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your Contractor OS account.</p>
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
