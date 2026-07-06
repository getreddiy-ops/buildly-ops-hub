import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Settings, User, Building2, CreditCard, Palette, Code2, Smartphone,
  Users as UsersIcon, LogOut, Save, Bot,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type LinkCard = {
  to: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const cards: LinkCard[] = [
  { to: "/app/business-profile", title: "Business Profile", description: "Company details used across estimates and invoices.", icon: Building2 },
  { to: "/app/branding", title: "Branding", description: "Logo, colors, and document templates.", icon: Palette },
  { to: "/app/billing", title: "Billing & Plan", description: "Subscription, invoices, and payment method.", icon: CreditCard },
  { to: "/app/crew", title: "Team & Crew", description: "Invite teammates and manage roles.", icon: UsersIcon },
  { to: "/app/phone-assistant", title: "Phone Assistant", description: "Configure your AI receptionist.", icon: Bot },
  { to: "/app/developer", title: "Developer", description: "GitHub sync and local development tools.", icon: Code2 },
];

export default function Preferences() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name ?? "");
        setPhone(data.phone ?? "");
      }
      setLoading(false);
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Preferences" description="Manage your profile and jump to any settings area." />

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Your profile</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-5555"
              disabled={loading}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveProfile} disabled={saving || loading}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Settings className="h-4 w-4" /> Settings areas
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Link key={c.to} to={c.to}>
              <Card className="group h-full p-5 transition-colors hover:border-primary/50 hover:bg-secondary/40">
                <c.icon className="mb-3 h-5 w-5 text-primary" />
                <div className="font-semibold">{c.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{c.description}</div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Card className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Smartphone className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Switch to field app</div>
            <div className="text-sm text-muted-foreground">Mobile-friendly view for crew in the field.</div>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link to="/field">Open field app</Link>
        </Button>
      </Card>

      <Card className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-semibold">Sign out</div>
          <div className="text-sm text-muted-foreground">End your session on this device.</div>
        </div>
        <Button
          variant="destructive"
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </Card>
    </div>
  );
}
