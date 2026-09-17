import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, FileText, LogOut, Mail, Palette, Phone, Save, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/hooks/useBranding";
import { toast } from "sonner";

export default function Settings() {
  const { user, activeOrg, signOut } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("full_name,phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setFullName(data?.full_name ?? "");
        setPhone(data?.phone ?? "");
        setLoading(false);
      });
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null, phone: phone.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  };

  const logout = async () => {
    await signOut();
    navigate("/login");
  };

  const orgName = activeOrg?.organization?.name ?? branding?.name ?? "Your business";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description={`Manage ${orgName} directly in FastTract.`}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{orgName}</CardTitle>
              <CardDescription>FastTract is the system of record for your business data.</CardDescription>
            </div>
            <Badge variant="secondary">FastTract native</Badge>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My profile</CardTitle>
          <CardDescription>Your FastTract sign-in and contact information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profilePhone">Phone</Label>
              <Input id="profilePhone" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={loading} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={loading || saving}>
              <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SettingsCard
          icon={Building2}
          title="Business profile"
          description="Company details, service area, estimating rules, and business knowledge."
          to="/app/business-profile"
        />
        <SettingsCard
          icon={Palette}
          title="Branding & documents"
          description="Logo, colors, estimate defaults, invoice terms, and customer-facing documents."
          to="/app/branding"
        />
        <SettingsCard
          icon={Users}
          title="Team & crew"
          description="Employees, roles, crew assignments, and field access."
          to="/app/crew"
        />
        <SettingsCard
          icon={Phone}
          title="Phone assistant"
          description="Configure the FastTract AI receptionist and business phone workflow."
          to="/app/phone-assistant"
        />
        <SettingsCard
          icon={Mail}
          title="Customer messages"
          description="Send customer texts and emails directly from FastTract."
          to="/app/messages"
        />
        <SettingsCard
          icon={FileText}
          title="Billing"
          description="Manage your FastTract subscription and account billing."
          to="/app/billing"
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">Signed in as {user?.email}</div>
            <div className="text-sm text-muted-foreground">Sign out of this FastTract session.</div>
          </div>
          <Button variant="outline" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsCard({ icon: Icon, title, description, to }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="w-full">
          <Link to={to}>Open</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
