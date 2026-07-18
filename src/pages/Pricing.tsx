import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { toast } from "sonner";
import { TIERS, type Tier } from "@/lib/tiers";
import { cn } from "@/lib/utils";
import { SEO } from "@/components/SEO";

type PlanDef = {
  tier: Tier;
  tagline: string;
  outcome: string;
  features: string[];
  highlight?: boolean;
};

const PLANS: PlanDef[] = [
  {
    tier: "base",
    tagline: "For solo contractors and small crews ready to get organized.",
    outcome: "Replace scattered notes and spreadsheets with one dependable system.",
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
    tagline: "For busy contractors who want less office work.",
    outcome: "Create estimates, update jobs, and handle admin work by chat or voice.",
    highlight: true,
    features: [
      "Everything in FastTract",
      "AI admin assistant",
      "Voice-to-form field completion",
      "Draft estimates & schedule jobs by chat or voice",
      "Confirm-before-write safety",
    ],
  },
  {
    tier: "premium",
    tagline: "For contractors who cannot afford to miss another call.",
    outcome: "Capture leads around the clock without hiring a full-time receptionist.",
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
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const checkoutRef = useRef<HTMLDivElement>(null);

  const onCta = async (tier: Tier) => {
    if (!user) {
      navigate("/signup");
      return;
    }
    if (!activeOrg) {
      navigate("/onboarding");
      return;
    }
    if (activeOrg.role !== "owner") {
      toast.error("Only the organization owner can subscribe.");
      return;
    }

    setSelectedTier(tier);
    try {
      await openCheckout({
        priceId: TIERS[tier].priceId,
        customerEmail: user.email ?? undefined,
        customData: { userId: user.id, orgId: activeOrg.organization_id },
        displayMode: "inline",
        frameTarget: "paddle-checkout-container",
      });
      setTimeout(() => checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      toast.error("Could not open checkout. Please try again.");
      console.error(e);
      setSelectedTier(null);
    }
  };

  const productLd = Object.values(TIERS).map((t) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    name: `FastTract — ${t.name}`,
    description: `FastTract ${t.name} plan at $${t.price}/month.`,
    brand: { "@type": "Brand", name: "FastTract" },
    offers: {
      "@type": "Offer",
      price: String(t.price),
      priceCurrency: "USD",
      url: "https://fasttract.org/pricing",
      availability: "https://schema.org/InStock",
    },
  }));

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Pricing — FastTract"
        description="Simple monthly plans for contractors. Start with a 7-day trial and choose the level of AI support your business needs."
        path="/pricing"
        jsonLd={productLd}
      />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Logo />
        <Button variant="ghost" asChild><Link to="/">Back</Link></Button>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Choose how much office work you want FastTract to handle.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Every plan keeps your leads, estimates, jobs, crew, and billing organized. Upgrade when you want AI to take more work off your plate.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" />7-day free trial</span>
            <span>No setup fee</span>
            <span>Cancel anytime</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">A card is required when you select a plan. You are not charged until the trial ends.</p>
        </div>

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
                  <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t.name}</h2>
                  {plan.highlight && (
                    <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                      Best for most contractors
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-semibold">${t.price}</span>
                  <span className="text-sm text-muted-foreground">/ month</span>
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">{plan.tagline}</p>
                <p className="mt-2 text-sm text-muted-foreground">{plan.outcome}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {feature}
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
                  {loading && selectedTier === plan.tier ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening checkout…</>
                  ) : (
                    `Start ${t.name} trial`
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-10 rounded-xl border border-border bg-card/60 p-6 text-center">
          <h2 className="text-lg font-semibold">Not sure which plan to choose?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Start with Plus. It gives you the full contractor system and the AI admin assistant without the added phone-answering cost.
          </p>
          <Button variant="link" asChild className="mt-2"><Link to="/contact">Talk with us before subscribing</Link></Button>
        </div>

        <div ref={checkoutRef} className="mt-16">
          {selectedTier && (
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Complete your {TIERS[selectedTier].name} checkout</h2>
                <p className="text-sm text-muted-foreground">
                  7-day free trial · ${TIERS[selectedTier].price}/month after · cancel anytime
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTier(null)}>Change plan</Button>
            </div>
          )}
          <div
            id="paddle-checkout-container"
            className={cn(
              "rounded-xl border bg-card p-4 shadow-card transition-all",
              !selectedTier && "hidden",
            )}
          />
        </div>
      </section>

      <footer className="mt-20 border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <div>© {new Date().getFullYear()} GetReddiy · FastTract</div>
          <nav className="flex flex-wrap items-center gap-4">
            <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy Notice</Link>
            <Link to="/refunds" className="hover:text-foreground">Refund Policy</Link>
            <Link to="/contact" className="hover:text-foreground">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
