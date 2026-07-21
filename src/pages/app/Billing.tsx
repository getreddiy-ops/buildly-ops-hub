import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, Loader2, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { toast } from "sonner";
import { TIERS, type Tier } from "@/lib/tiers";
import { trackTrialStart } from "@/lib/gtag";
import { cn } from "@/lib/utils";

const ORDER: Tier[] = ["base", "plus", "premium"];
const ACTIVATION_POLL_MS = 2_000;
const ACTIVATION_TIMEOUT_MS = 45_000;
type ActivationState = "idle" | "verifying" | "delayed";

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
  const { user, activeOrg } = useAuth();
  const { subscription, isActive, isPastDue, isOwner, tier, loading, refetch } = useSubscription();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const [portalLoading, setPortalLoading] = useState(false);
  const [pendingTier, setPendingTier] = useState<Tier | null>(null);
  const [activationState, setActivationState] = useState<ActivationState>("idle");
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get("checkout") === "success") {
      setActivationState("verifying");
      const nextParams = new URLSearchParams(params);
      nextParams.delete("checkout");
      setParams(nextParams, { replace: true });
    }
  }, [params, setParams, refetch]);

  useEffect(() => {
    if (activationState !== "verifying") return;
    void refetch();
    const poll = window.setInterval(() => void refetch(), ACTIVATION_POLL_MS);
    const stop = window.setTimeout(() => {
      window.clearInterval(poll);
      setActivationState("delayed");
    }, ACTIVATION_TIMEOUT_MS);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(stop);
    };
  }, [activationState, refetch]);

  useEffect(() => {
    if (activationState !== "verifying" || !isActive) return;
    setActivationState("idle");
    if (subscription?.status === "trialing") trackTrialStart();
    toast.success("Subscription activated — your plan is ready.");
  }, [activationState, isActive, subscription?.status]);

  const subscribeTo = async (target: Tier) => {
    if (!activeOrg) return;
    if (!isOwner) {
      toast.error("Only the organization owner can subscribe.");
      return;
    }
    if (isActive) {
      await onManage();
      return;
    }
    setPendingTier(target);
    try {
      await openCheckout({
        priceId: TIERS[target].priceId,
        customerEmail: user?.email ?? undefined,
        customData: { userId: user?.id ?? "", orgId: activeOrg.organization_id },
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
      const { data, error } = await supabase.functions.invoke("paddle-customer-portal", {
        body: { organizationId: activeOrg.organization_id, environment: getPaddleEnvironment() },
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
          {activationState === "verifying" && (
            <Card role="status" className="border-primary/50 bg-primary/5 p-5">
              <div className="flex items-start gap-3">
                <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
                <div>
                  <h3 className="font-semibold">Activating your subscription…</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Checkout finished. We’re securely confirming it with Paddle. This usually takes less than a minute.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {activationState === "delayed" && (
            <Card role="alert" className="border-amber-500/50 bg-amber-500/5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex max-w-2xl items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div>
                    <h3 className="font-semibold">Your access is still syncing</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Don’t submit another payment. Check again below; if access still does not appear, contact support and we’ll verify the checkout.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setActivationState("verifying")}>
                    Check again
                  </Button>
                  <Button variant="ghost" asChild>
                    <a href="mailto:getreddiy@gmail.com">Contact support</a>
                  </Button>
                </div>
              </div>
            </Card>
          )}

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
              const currentIdx = tier ? ORDER.indexOf(tier) : -1;
              const targetIdx = ORDER.indexOf(t);
              const action = !isActive
                ? "Start 7-day free trial"
                : isCurrent
                ? "Current plan"
                : targetIdx > currentIdx
                ? "Manage upgrade"
                : "Manage downgrade";

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
                    onClick={() => subscribeTo(t)}
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
