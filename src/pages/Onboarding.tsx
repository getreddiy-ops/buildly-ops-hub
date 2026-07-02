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
  const [companyName, setCompanyName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
    if (!loading && memberships.length > 0) navigate("/app");
  }, [user, loading, memberships, navigate]);

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
      <header className="mx-auto max-w-7xl px-4 py-5"><Logo /></header>
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-8 shadow-card">
          <h1 className="text-2xl font-semibold">Set up your company</h1>
          <p className="mt-1 text-sm text-muted-foreground">You can invite your crew right after this.</p>
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
