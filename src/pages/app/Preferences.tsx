import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Settings, User, Building2, CreditCard, Palette, Code2, Smartphone,
  Users as UsersIcon, LogOut, Save, Bot, FileText, ArrowRight, CheckCircle2, Circle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/hooks/useBranding";
import { toast } from "sonner";

type BusinessProfile = Record<string, unknown> | null;

function truncate(s: string | undefined | null, n = 90) {
  if (!s) return "";
  const t = String(s).replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

export default function Preferences() {
  const { user, activeOrg, signOut, isPlatformAdmin } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(null);

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

  useEffect(() => {
    if (!activeOrg) return;
    (async () => {
      const { data } = await supabase
        .from("organizations")
        .select("business_profile")
        .eq("id", activeOrg.organization_id)
        .maybeSingle();
      setBusinessProfile((data?.business_profile as BusinessProfile) ?? {});
    })();
  }, [activeOrg]);

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

  const invoiceDefaults = branding?.document_defaults?.invoice ?? {};
  const estimateDefaults = branding?.document_defaults?.estimate ?? {};
  const contractDefaults = branding?.document_defaults?.contract ?? {};

  const checklist = useMemo(() => {
    const hasLogo = !!branding?.logo_signed_url;
    const hasBrandColor = !!branding?.brand_color;
    const hasAddress = !!branding?.address;
    const hasPhone = !!branding?.phone;
    const hasInvoiceDefaults = !!(invoiceDefaults.header || invoiceDefaults.footer || invoiceDefaults.terms);
    const hasBusinessProfile =
      !!businessProfile && Object.keys(businessProfile).length > 0;
    const items = [
      { label: "Company logo uploaded", done: hasLogo, to: "/app/branding" },
      { label: "Brand color chosen", done: hasBrandColor, to: "/app/branding" },
      { label: "Business address on file", done: hasAddress, to: "/app/branding" },
      { label: "Business phone on file", done: hasPhone, to: "/app/branding" },
      { label: "Invoice defaults set", done: hasInvoiceDefaults, to: "/app/branding" },
      { label: "Business profile filled in", done: hasBusinessProfile, to: "/app/business-profile" },
    ];
    const done = items.filter((i) => i.done).length;
    return { items, done, total: items.length, pct: Math.round((done / items.length) * 100) };
  }, [branding, invoiceDefaults, businessProfile]);

  const orgName = activeOrg?.organization?.name ?? branding?.name ?? "Your business";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description={`Personalize how ${orgName} shows up on estimates, invoices, and customer messages.`}
      />

      {/* Org overview + setup progress */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {branding?.logo_signed_url ? (
              <img
                src={branding.logo_signed_url}
                alt={orgName}
                className="h-14 w-14 rounded-md border border-border object-contain p-1"
              />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-md border border-dashed border-border text-lg font-semibold text-muted-foreground">
                {orgName?.[0]?.toUpperCase() ?? "F"}
              </div>
            )}
            <div>
              <div className="text-lg font-semibold">{orgName}</div>
              <div className="text-sm text-muted-foreground">
                Signed in as {user?.email}
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <Badge variant={checklist.pct === 100 ? "default" : "secondary"}>
                  Setup {checklist.pct}%
                </Badge>
                <span className="text-muted-foreground">
                  {checklist.done} of {checklist.total} steps complete
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/app/branding">
                <Palette className="mr-2 h-4 w-4" /> Customize invoices
              </Link>
            </Button>
            <Button asChild>
              <Link to="/app/business-profile">
                <Building2 className="mr-2 h-4 w-4" /> Edit business profile
              </Link>
            </Button>
          </div>
        </div>

        {checklist.pct < 100 && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {checklist.items.map((i) => (
              <Link
                key={i.label}
                to={i.to}
                className="flex items-center gap-2 rounded-md border border-border/60 p-2 text-sm hover:bg-secondary/40"
              >
                {i.done ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={i.done ? "text-muted-foreground line-through" : ""}>{i.label}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* My profile */}
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">My profile</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">Contact support to change your sign-in email.</p>
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

      {/* Invoice & document appearance — prominent */}
      <Card className="border-primary/40 p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Invoice & document appearance</h3>
              <p className="text-sm text-muted-foreground">
                What customers see on every estimate and invoice you send.
              </p>
            </div>
          </div>
          <Button asChild size="lg">
            <Link to="/app/branding">
              <Palette className="mr-2 h-4 w-4" /> Customize invoices
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Thumbnail */}
          <div className="rounded-md border border-border bg-secondary/30 p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Preview</div>
            <div
              className="mt-2 aspect-[8.5/11] w-full overflow-hidden rounded-sm border border-border bg-background p-3 shadow-sm"
              style={{
                borderTop: `4px solid ${branding?.brand_color ?? "#3b82f6"}`,
              }}
            >
              <div className="flex items-start justify-between">
                {branding?.logo_signed_url ? (
                  <img src={branding.logo_signed_url} alt="" className="h-8 max-w-[70%] object-contain" />
                ) : (
                  <div className="text-sm font-semibold">{orgName}</div>
                )}
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Invoice</div>
              </div>
              <div className="mt-3 space-y-1">
                <div className="h-1.5 w-3/4 rounded bg-muted" />
                <div className="h-1.5 w-1/2 rounded bg-muted" />
              </div>
              <div className="mt-3 h-16 rounded border border-dashed border-border" />
              <div className="mt-2 space-y-1">
                <div className="h-1 w-full rounded bg-muted" />
                <div className="h-1 w-5/6 rounded bg-muted" />
                <div className="h-1 w-2/3 rounded bg-muted" />
              </div>
            </div>
          </div>

          {/* Brand summary */}
          <div className="space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Brand colors</div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="h-8 w-8 rounded-md border border-border"
                  style={{ background: branding?.brand_color ?? "#3b82f6" }}
                />
                <span
                  className="h-8 w-8 rounded-md border border-border"
                  style={{ background: branding?.brand_color_secondary ?? "#1e293b" }}
                />
                <span className="text-xs text-muted-foreground">
                  {branding?.brand_color ?? "—"} · {branding?.brand_color_secondary ?? "—"}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Logo</div>
              <div className="mt-1 text-sm">
                {branding?.logo_signed_url ? "Uploaded" : "Not uploaded yet"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Legal name</div>
              <div className="mt-1 text-sm">{branding?.legal_name || branding?.name || "—"}</div>
            </div>
          </div>

          {/* Invoice defaults summary */}
          <div className="space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Invoice header</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {truncate(invoiceDefaults.header) || "Not set"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Payment terms</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {truncate(invoiceDefaults.terms) || "Not set"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Notes</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {truncate(invoiceDefaults.notes) || "Not set"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Footer</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {truncate(invoiceDefaults.footer) || "Not set"}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Two-column: Estimate & contract defaults + Company details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Estimate & contract defaults</h3>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/branding">Edit <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Estimate terms</div>
              <div className="text-muted-foreground">{truncate(estimateDefaults.terms) || "Not set"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Estimate notes</div>
              <div className="text-muted-foreground">{truncate(estimateDefaults.notes) || "Not set"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Contract terms</div>
              <div className="text-muted-foreground">{truncate(contractDefaults.terms) || "Not set"}</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Company details</h3>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/branding">Edit <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Address</dt>
              <dd className="text-right">{branding?.address || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="text-right">{branding?.phone || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-right">{branding?.email || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Website</dt>
              <dd className="text-right">{branding?.website || "—"}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Team & AI */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Team & crew</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Invite office staff and crew members, set roles, and manage pay rates.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/app/crew">Manage team <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </Card>

        <Card className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">AI phone & business profile</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Teach the AI phone assistant about your trades, pricing, and how you talk to customers.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/app/business-profile">Business profile</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/phone-assistant">Phone assistant</Link>
            </Button>
          </div>
        </Card>
      </div>

      {/* Field app switcher */}
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

      {isPlatformAdmin && (
        <Card className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Code2 className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">Developer</div>
              <div className="text-sm text-muted-foreground">GitHub sync and local development tools.</div>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link to="/app/developer">Open developer</Link>
          </Button>
        </Card>
      )}

      {/* Billing — compact, LAST */}
      <Card className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Billing & plan</div>
            <div className="text-sm text-muted-foreground">
              Manage your subscription, payment method, and invoices.
            </div>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link to="/app/billing">Go to billing</Link>
        </Button>
      </Card>

      {/* Sign out */}
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
