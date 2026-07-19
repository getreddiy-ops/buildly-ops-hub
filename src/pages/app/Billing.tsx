import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Loader2, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TIERS, type Tier } from "@/lib/tiers";
import { trackTrialStart } from "@/lib/gtag";
import { cn } from "@/lib/utils";

const ORDER: Tier[] = ["base", "plus", "premium"];

const PLAN_FEATURES: Record<Tier, string[]> = {
  base: [
    "Leads, customers & estimates",
    "Jobs, scheduling & crew",
    "GPS time tracking & approvals",
    "Job costing",
    "Mobile field app",
  ],
  plus: [
    "Everything in FastTract",
    "AI admin assistant",
    "Voice dictation",
  ],
  premium: [
    "Everything in Plus",
    "AI phone answering assistant",
    "24/7 lead capture & booking",
  ],
};

export default function Billing() {
  const { activeOrg } = useAuth();
  const { subscription, isActive, isPastDue, isOwner, tier, loading, refetch } = useSubscription();
  const { openCheckout, loading: checkoutLoading } = useStripeCheckout();
  const [portalLoading, setPortalLoading] = useState(false);
  const [pendingTier, setPendingTier] = useState<Tier | null>(null);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get("checkout") === "success") {
      trackTrialStart();
      toast.success("Subscription activated!");
      const t = setInterval(() => refetch(), 2000);
      const stop = setTimeout(() => clearInterval(t), 15000);
      params.delete("checkout");
      setParams(params, { replace: true });
      return () => { clearInterval(t); clearTimeout(stop); };
    }
  }, [params, setParams, refetch]);

  const subscribeTo = async (target: Tier) => {
    if (!activeOrg) return;
    if (!isOwner) {
      toast.error("Only the organization owner can subscribe.");
      return;
    }
    setPendingTier(target);
    try {
      await openCheckout({
        priceId: TIERS[target].priceId,
        organizationId: activeOrg.organization_id,
      });
    } catch (e) {
      toast.error("Could not open checkout");
      console.error(e);
    } finally {
      setPendingTier(null);
    }
  };

  const onManage = async () => {
    if (!activeOrg) return;
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-customer-portal", {
        body: { organizationId: activeOrg.organization_id },
      });
      if (error || !data?.url) throw new Error(error?.message ?? "Failed to open portal");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not open customer portal");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Billing" description="Manage your FastTract subscription" />

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {isActive && tier && (
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{TIERS[tier].name}</h3>
                    <Badge variant={isPastDue ? "destructive" : "default"}>
                      {subscription?.cancel_at_period_end ? "Cancels at period end" : subscription?.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    ${TIERS[tier].price} / month
                    {subscription?.current_period_end && (
                      <> · {subscription.cancel_at_period_end ? "ends" : "renews"} {new Date(subscription.current_period_end).toLocaleDateString()}</>
                    )}
                  </p>
                  {isPastDue && (
                    <p className="mt-2 text-sm text-destructive">
                      Your last payment failed. Update your payment method to keep your subscription.
                    </p>
                  )}
                  {!isOwner && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Only the organization owner can manage billing.
                    </p>
                  )}
                </div>
                {isOwner && (
                  <Button variant="outline" onClick={onManage} disabled={portalLoading}>
                    {portalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                    Manage subscription
                  </Button>
                )}
              </div>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {ORDER.map((t) => {
              const plan = TIERS[t];
              const isCurrent = isActive && tier === t;
              const action = !isActive
                ? "Start 7-day free trial"
                : isCurrent
                ? "Current plan"
                : "Manage plan";

              return (
                <Card
                  key={t}
                  className={cn("flex flex-col p-6", isCurrent && "border-primary ring-1 ring-primary")}
                >
                  <h4 className="font-semibold">{plan.name}</h4>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold">${plan.price}</span>
                    <span className="text-sm text-muted-foreground">/ mo</span>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    {PLAN_FEATURES[t].map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-6 w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || !isOwner || (checkoutLoading && pendingTier === t)}
                    onClick={() => isActive ? onManage() : subscribeTo(t)}
                  >
                    {checkoutLoading && pendingTier === t ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening checkout…</>
                    ) : action}
                  </Button>
                </Card>
              );
            })}
          </div>
          {!isOwner && (
            <p className="text-xs text-muted-foreground">
              Ask your organization owner to change plans.
            </p>
          )}
        </>
      )}
    </div>
  );
}
