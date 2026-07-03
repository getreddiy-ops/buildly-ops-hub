import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, memberships, loading, refresh, setActiveOrgId, signOut } = useAuth();
  const { isPlatformAdmin, isAgent } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (memberships.length > 0) {
      navigate("/app", { replace: true });
      return;
    }
    // Users without an org but with a platform role belong in their own portal.
    if (isPlatformAdmin) navigate("/admin", { replace: true });
    else if (isAgent) navigate("/agent", { replace: true });
  }, [user, loading, memberships, isPlatformAdmin, isAgent, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { data: org, error: oerr } = await supabase
      .from("organizations")
      .insert({ name: companyName, owner_id: user.id })
      .select()
      .single();
    if (oerr || !org) {
      setSubmitting(false);
      return toast({ title: "Could not create company", description: oerr?.message, variant: "destructive" });
    }
    const { error: merr } = await supabase
      .from("organization_members")
      .insert({ organization_id: org.id, user_id: user.id, role: "owner" });
    setSubmitting(false);
    if (merr) return toast({ title: "Could not add you as owner", description: merr.message, variant: "destructive" });
    setActiveOrgId(org.id);
    await refresh();
    toast({ title: "Welcome", description: `${org.name} is set up.` });
    navigate("/app");
  };

  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
        <Logo />
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await signOut();
            navigate("/login");
          }}
        >
          Sign out
        </Button>
      </header>
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-8 shadow-card">
          <h1 className="text-2xl font-semibold">Set up your company</h1>
          <p className="mt-1 text-sm text-muted-foreground">You can invite your crew right after this. Already have a company? <button type="button" className="text-primary underline" onClick={async () => { await signOut(); navigate("/login"); }}>Sign in with a different account</button>.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="company">Company name</Label>
              <Input id="company" required value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Roofing & Renovations" />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating…" : "Create company"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
