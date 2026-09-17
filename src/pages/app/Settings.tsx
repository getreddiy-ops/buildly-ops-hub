import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, CreditCard, FileText, Loader2, LogOut, Mail, Palette, Phone, Save, Users } from "lucide-react";
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

type PaymentStatus = {
  accountId: string | null;
  status: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};

const emptyPayments: PaymentStatus = {
  accountId: null,
  status: "not_connected",
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
};

export default function Settings() {
  const { user, activeOrg, signOut } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payments, setPayments] = useState<PaymentStatus>(emptyPayments);
  const [paymentBusy, setPaymentBusy] = useState(false);

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

  const loadPayments = async () => {
    if (!activeOrg) return;
    const { data, error } = await supabase
      .from("organizations")
      .select("stripe_connected_account_id,stripe_connect_status,stripe_charges_enabled,stripe_payouts_enabled,stripe_details_submitted")
      .eq("id", activeOrg.organization_id)
      .maybeSingle();
    if (error) return;
    setPayments({
      accountId: data?.stripe_connected_account_id ?? null,
      status: data?.stripe_connect_status ?? "not_connected",
      chargesEnabled: data?.stripe_charges_enabled === true,
      payoutsEnabled: data?.stripe_payouts_enabled === true,
      detailsSubmitted: data?.stripe_details_submitted === true,
    });
  };

  useEffect(() => {
    if (!activeOrg) return;
    void loadPayments();
    const stripeReturn = new URLSearchParams(window.location.search).get("stripe");
    if (!stripeReturn) return;

    setPaymentBusy(true);
    void supabase.functions.invoke("stripe-connect", {
      body: { organizationId: activeOrg.organization_id, action: "status" },
    }).then(({ data, error }) => {
      setPaymentBusy(false);
      if (error || data?.error) toast.error(data?.error || error?.message || "Could not refresh payment status");
      else {
        toast.success(data?.chargesEnabled ? "Customer payments are ready" : "Payment setup saved — Stripe may still need more information");
        void loadPayments();
      }
      window.history.replaceState({}, "", "/app/settings");
    });
  }, [activeOrg]);

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

  const connectPayments = async () => {
    if (!activeOrg || paymentBusy) return;
    setPaymentBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect", {
        body: { organizationId: activeOrg.organization_id, action: "onboard" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("Stripe onboarding is unavailable");
      window.location.assign(data.url);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not start payment setup");
      setPaymentBusy(false);
    }
  };

  const logout = async () => {
    await signOut();
    navigate("/login");
  };

  const orgName = activeOrg?.organization?.name ?? branding?.name ?? "Your business";
  const paymentReady = payments.chargesEnabled;

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

      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Customer payments</CardTitle>
                <CardDescription>Connect Stripe so customers can pay estimate deposits directly to your business.</CardDescription>
              </div>
            </div>
            <Badge variant={paymentReady ? "default" : "secondary"}>
              {paymentReady ? "Ready" : payments.accountId ? "Setup in progress" : "Not connected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {paymentReady
              ? "Online deposit payments are enabled on accepted FastTract estimates."
              : payments.detailsSubmitted
                ? "Stripe has your information. Payment activation may still be pending review."
                : "Stripe securely handles identity verification, card processing, and payouts."}
          </div>
          <Button onClick={connectPayments} disabled={paymentBusy}>
            {paymentBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {paymentReady ? "Manage Stripe" : payments.accountId ? "Continue setup" : "Connect Stripe"}
          </Button>
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
