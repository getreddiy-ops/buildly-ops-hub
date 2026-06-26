import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Bot, Phone, Sparkles } from "lucide-react";

type Profile = {
  industry?: string;
  sub_trades?: string[];
  services?: string;
  service_area?: string;
  years_in_business?: string;
  crew_size?: string;
  license_info?: string;
  insurance_info?: string;
  business_hours?: string;
  emergency_hours?: string;
  pricing_model?: string;
  typical_price_range?: string;
  free_estimates?: boolean;
  payment_terms?: string;
  warranty?: string;
  brand_voice?: string;
  do_not_say?: string;
  faqs?: string;
  booking_policy?: string;
  cancellation_policy?: string;
  competitors?: string;
  unique_selling_points?: string;
  lead_qualification?: string;
  out_of_scope?: string;
  escalation_contact?: string;
  notes?: string;
};

const SUB_TRADE_SUGGESTIONS = [
  "Roofing", "Siding", "Gutters", "Windows", "Decks", "Kitchen Remodel",
  "Bathroom Remodel", "Painting", "Flooring", "Concrete", "Fencing",
  "Landscaping", "HVAC", "Plumbing", "Electrical", "General Contracting",
];

export default function BusinessProfile() {
  const { activeOrg } = useAuth();
  const [profile, setProfile] = useState<Profile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeOrg) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("organizations")
        .select("business_profile")
        .eq("id", activeOrg.organization_id)
        .single();
      setProfile((data?.business_profile as Profile) ?? {});
      setLoading(false);
    })();
  }, [activeOrg]);

  const update = <K extends keyof Profile>(k: K, v: Profile[K]) =>
    setProfile((p) => ({ ...p, [k]: v }));

  const toggleTrade = (t: string) => {
    const cur = new Set(profile.sub_trades ?? []);
    cur.has(t) ? cur.delete(t) : cur.add(t);
    update("sub_trades", Array.from(cur));
  };

  const save = async () => {
    if (!activeOrg) return;
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({ business_profile: profile })
      .eq("id", activeOrg.organization_id);
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Business profile saved", description: "Your AI Assistant and Phone Receptionist are now briefed." });
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Profile"
        description="Answer these once. Your AI Assistant and Phone Receptionist use this to sound like your business."
      />

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <span className="text-foreground">Powers two AI services:</span>{" "}
            <Bot className="inline h-3.5 w-3.5" /> Office Assistant ·{" "}
            <Phone className="inline h-3.5 w-3.5" /> Phone Receptionist. The more specific you are, the
            fewer guesses they have to make.
          </div>
        </CardContent>
      </Card>

      {/* 1 — Industry & services */}
      <Card>
        <CardHeader>
          <CardTitle>1. Industry & services</CardTitle>
          <CardDescription>What kind of contractor are you, and what jobs do you take?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="industry">Primary trade / industry</Label>
            <Input id="industry" value={profile.industry ?? ""} onChange={(e) => update("industry", e.target.value)}
              placeholder="e.g. Roofing & exterior renovations" />
          </div>
          <div>
            <Label>Sub-trades you offer</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUB_TRADE_SUGGESTIONS.map((t) => {
                const on = profile.sub_trades?.includes(t);
                return (
                  <button key={t} type="button" onClick={() => toggleTrade(t)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted hover:border-primary/50"}`}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label htmlFor="services">Detailed services & specialties</Label>
            <Textarea id="services" rows={3} value={profile.services ?? ""} onChange={(e) => update("services", e.target.value)}
              placeholder="e.g. Asphalt shingle replacement, metal roofing, storm-damage insurance claims, 24/7 emergency tarping." />
          </div>
          <div>
            <Label htmlFor="out_of_scope">What jobs do you NOT take?</Label>
            <Textarea id="out_of_scope" rows={2} value={profile.out_of_scope ?? ""} onChange={(e) => update("out_of_scope", e.target.value)}
              placeholder="e.g. We don't do flat commercial roofs, mobile homes, or jobs under $1,500." />
          </div>
        </CardContent>
      </Card>

      {/* 2 — Service area & operations */}
      <Card>
        <CardHeader>
          <CardTitle>2. Service area & operations</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="area">Service area (cities / zip codes / radius)</Label>
            <Textarea id="area" rows={2} value={profile.service_area ?? ""} onChange={(e) => update("service_area", e.target.value)}
              placeholder="e.g. Within 40 miles of Dallas, TX. Service Dallas, Plano, Frisco, McKinney, Allen." />
          </div>
          <div>
            <Label htmlFor="years">Years in business</Label>
            <Input id="years" value={profile.years_in_business ?? ""} onChange={(e) => update("years_in_business", e.target.value)}
              placeholder="e.g. 12" />
          </div>
          <div>
            <Label htmlFor="crew">Crew size</Label>
            <Input id="crew" value={profile.crew_size ?? ""} onChange={(e) => update("crew_size", e.target.value)}
              placeholder="e.g. 2 crews, 8 total" />
          </div>
          <div>
            <Label htmlFor="hours">Business hours</Label>
            <Input id="hours" value={profile.business_hours ?? ""} onChange={(e) => update("business_hours", e.target.value)}
              placeholder="e.g. Mon–Fri 7am–6pm, Sat 8am–noon" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="emergency">After-hours / emergency policy</Label>
            <Input id="emergency" value={profile.emergency_hours ?? ""} onChange={(e) => update("emergency_hours", e.target.value)}
              placeholder="e.g. 24/7 for storm damage tarping; otherwise next business day callback." />
          </div>
          <div>
            <Label htmlFor="license">License number / state</Label>
            <Input id="license" value={profile.license_info ?? ""} onChange={(e) => update("license_info", e.target.value)}
              placeholder="e.g. TX RCAT #12345" />
          </div>
          <div>
            <Label htmlFor="ins">Insurance</Label>
            <Input id="ins" value={profile.insurance_info ?? ""} onChange={(e) => update("insurance_info", e.target.value)}
              placeholder="e.g. $2M general liability, fully bonded" />
          </div>
        </CardContent>
      </Card>

      {/* 3 — Pricing & money */}
      <Card>
        <CardHeader>
          <CardTitle>3. Pricing & payments</CardTitle>
          <CardDescription>Lets the AI quote ranges without inventing numbers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="model">How do you price?</Label>
            <Textarea id="model" rows={2} value={profile.pricing_model ?? ""} onChange={(e) => update("pricing_model", e.target.value)}
              placeholder="e.g. Per square for roofs, hourly $95/hr for repairs, fixed bid for remodels." />
          </div>
          <div>
            <Label htmlFor="range">Typical project price ranges</Label>
            <Textarea id="range" rows={3} value={profile.typical_price_range ?? ""} onChange={(e) => update("typical_price_range", e.target.value)}
              placeholder="e.g. Roof replacement $9k–$22k. Gutter install $1.2k–$3k. Repair calls $250 min." />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="free" checked={!!profile.free_estimates}
              onCheckedChange={(v) => update("free_estimates", !!v)} />
            <Label htmlFor="free" className="cursor-pointer">We offer free estimates</Label>
          </div>
          <div>
            <Label htmlFor="pay">Payment terms & accepted methods</Label>
            <Input id="pay" value={profile.payment_terms ?? ""} onChange={(e) => update("payment_terms", e.target.value)}
              placeholder="e.g. 30% deposit, 70% on completion. Card, ACH, check. Financing available." />
          </div>
          <div>
            <Label htmlFor="war">Warranty / guarantee</Label>
            <Input id="war" value={profile.warranty ?? ""} onChange={(e) => update("warranty", e.target.value)}
              placeholder="e.g. 10-year workmanship, manufacturer materials warranty up to 50 yrs." />
          </div>
        </CardContent>
      </Card>

      {/* 4 — Voice & rules */}
      <Card>
        <CardHeader>
          <CardTitle>4. Brand voice & rules</CardTitle>
          <CardDescription>How should the AI sound, and what should it never say?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="voice">Brand voice / tone</Label>
            <Textarea id="voice" rows={2} value={profile.brand_voice ?? ""} onChange={(e) => update("brand_voice", e.target.value)}
              placeholder="e.g. Friendly, plainspoken, no jargon. Treat every caller like a neighbor." />
          </div>
          <div>
            <Label htmlFor="dns">Things to NEVER say or promise</Label>
            <Textarea id="dns" rows={2} value={profile.do_not_say ?? ""} onChange={(e) => update("do_not_say", e.target.value)}
              placeholder="e.g. Never quote a final price. Never promise same-day service. Don't mention competitor names." />
          </div>
          <div>
            <Label htmlFor="usp">What makes you different (USPs)</Label>
            <Textarea id="usp" rows={2} value={profile.unique_selling_points ?? ""} onChange={(e) => update("unique_selling_points", e.target.value)}
              placeholder="e.g. Owner on every job, GAF Master Elite certified, 5-yr leak-free guarantee." />
          </div>
          <div>
            <Label htmlFor="comp">Main competitors (so AI can position you against them)</Label>
            <Input id="comp" value={profile.competitors ?? ""} onChange={(e) => update("competitors", e.target.value)}
              placeholder="e.g. ABC Roofing, BigBox Home Services" />
          </div>
        </CardContent>
      </Card>

      {/* 5 — Phone & booking specific */}
      <Card>
        <CardHeader>
          <CardTitle>5. Phone & booking playbook</CardTitle>
          <CardDescription>Used most heavily by the Phone Receptionist.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="qual">Lead qualification questions to ask every caller</Label>
            <Textarea id="qual" rows={3} value={profile.lead_qualification ?? ""} onChange={(e) => update("lead_qualification", e.target.value)}
              placeholder={"1. Property address?\n2. Single or multi-story?\n3. Insurance claim or out-of-pocket?\n4. Timeline?"} />
          </div>
          <div>
            <Label htmlFor="book">Booking / scheduling policy</Label>
            <Textarea id="book" rows={2} value={profile.booking_policy ?? ""} onChange={(e) => update("booking_policy", e.target.value)}
              placeholder="e.g. Estimates booked in 2-hr windows, weekdays 9am–4pm. Confirm 24 hrs prior by text." />
          </div>
          <div>
            <Label htmlFor="cancel">Cancellation / no-show policy</Label>
            <Input id="cancel" value={profile.cancellation_policy ?? ""} onChange={(e) => update("cancellation_policy", e.target.value)}
              placeholder="e.g. Free reschedule with 24 hr notice." />
          </div>
          <div>
            <Label htmlFor="esc">Who/what to escalate to a human</Label>
            <Input id="esc" value={profile.escalation_contact ?? ""} onChange={(e) => update("escalation_contact", e.target.value)}
              placeholder="e.g. Transfer billing disputes & active leak emergencies to owner at 555-123-4567." />
          </div>
          <div>
            <Label htmlFor="faq">Frequently asked questions (with your answers)</Label>
            <Textarea id="faq" rows={5} value={profile.faqs ?? ""} onChange={(e) => update("faqs", e.target.value)}
              placeholder={"Q: Do you do insurance claims?\nA: Yes, we work directly with all major carriers.\n\nQ: How long does a roof replacement take?\nA: Most homes 1–2 days."} />
          </div>
        </CardContent>
      </Card>

      {/* 6 — Anything else */}
      <Card>
        <CardHeader>
          <CardTitle>6. Anything else the AI should know</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea rows={4} value={profile.notes ?? ""} onChange={(e) => update("notes", e.target.value)}
            placeholder="Seasonal promos, partner referrals, certifications, hiring status, anything specific about how you run the business." />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" onClick={save} disabled={saving} className="shadow-lg">
          {saving ? "Saving…" : "Save business profile"}
        </Button>
      </div>
    </div>
  );
}
