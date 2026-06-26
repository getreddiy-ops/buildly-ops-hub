import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { toast } from "sonner";
import { TIERS, type Tier } from "@/lib/tiers";
import { cn } from "@/lib/utils";
import { SEO } from "@/components/SEO";

type PlanDef = {
  tier: Tier;
  tagline: string;
  features: string[];
  highlight?: boolean;
};

const PLANS: PlanDef[] = [
  {
    tier: "base",
    tagline: "Run your contracting business end-to-end.",
    features: [
      "Leads, customers & estimates",
      "Jobs, scheduling & crew management",
      "GPS-verified time tracking",
      "Boss-approved hours & job costing",
      "Mobile field app",
      "Unlimited crew members",
    ],
  },
  {
    tier: "plus",
    tagline: "Everything in Contractor OS, plus the AI admin assistant.",
    highlight: true,
    features: [
      "Everything in Contractor OS",
      "AI admin assistant",
      "Draft estimates & schedule jobs by chat",
      "Voice-to-text dictation",
      "Confirm-before-write safety",
    ],
  },
  {
    tier: "premium",
    tagline: "Plus the AI phone answering assistant.",
    features: [
      "Everything in Plus",
      "AI phone answering assistant",
      "Captures leads 24/7",
      "Books appointments on your calendar",
      "Call transcripts & summaries",
    ],
  },
];

export default function Pricing() {
  const { user, activeOrg } = useAuth();
  const navigate = useNavigate();
  const { openCheckout, loading } = usePaddleCheckout();

  const onCta = async (tier: Tier) => {
    if (!user) { navigate("/signup"); return; }
    if (!activeOrg) { navigate("/onboarding"); return; }
    if (activeOrg.role !== "owner") {
      toast.error("Only the organization owner can subscribe.");
      return;
    }
    try {
      await openCheckout({
        priceId: TIERS[tier].priceId,
        customerEmail: user.email ?? undefined,
        customData: { userId: user.id, orgId: activeOrg.organization_id },
      });
    } catch (e) {
      toast.error("Could not open checkout");
      console.error(e);
    }
  };

  const productLd = Object.values(TIERS).map((t) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    name: `Contractor OS — ${t.name}`,
    description: `Contractor OS ${t.name} plan at $${t.price}/month.`,
    brand: { "@type": "Brand", name: "Contractor OS" },
    offers: {
      "@type": "Offer",
      price: String(t.price),
      priceCurrency: "USD",
      url: "https://contractoros.online/pricing",
      availability: "https://schema.org/InStock",
    },
  }));

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Pricing — Contractor OS"
        description="Simple monthly plans for contractors. Base $69, Plus $169 (adds AI assistant with voice form filling), Premium $269 (adds AI phone answering). Cancel anytime."
        path="/pricing"
        jsonLd={productLd}
      />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Logo />
        <Button variant="ghost" asChild><Link to="/">Back</Link></Button>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Pick the plan that fits your crew.</h1>
          <p className="mt-3 text-muted-foreground">Start with a 7-day free trial on any plan. Monthly billing per company. Cancel anytime.</p>
          <p className="mt-1 text-xs text-muted-foreground">Card required — you won't be charged until your trial ends.</p>
        </div>
        <h2 className="mb-6 text-center text-xl font-medium tracking-tight">Plans</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const t = TIERS[plan.tier];
            return (
              <div
                key={plan.tier}
                className={cn(
                  "flex flex-col rounded-xl border bg-card p-8 shadow-card",
                  plan.highlight && "border-primary ring-1 ring-primary",
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    {t.name}
                  </h3>
                  {plan.highlight && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                      Popular
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-semibold">${t.price}</span>
                  <span className="text-sm text-muted-foreground">/ mo</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{plan.tagline}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-8 w-full"
                  size="lg"
                  variant={plan.highlight ? "default" : "outline"}
                  onClick={() => onCta(plan.tier)}
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening checkout…</>
                  ) : user ? "Start 7-day free trial" : "Start free trial"}
                </Button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
