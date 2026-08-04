import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Loader2, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  plus: ["Everything in FastTract", "AI admin assistant", "Voice dictation"],
  premium: ["Everything in Plus", "AI phone answering assistant", "24/7 lead capture & booking"],
};

export default function Billing() {
  const { activeOrg } = useAuth();
  const {
    subscription,
    isActive,
    isPastDue,
    isTrialing,
    isOwner,
    tier,
    scheduledTier,
    loading,
    refetch,
  } = useSubscription();
  const { openCheckout, loading: checkoutLoading } = useStripeCheckout();
  const [portalLoading, setPortalLoading] = useState(false);
  const [pendingTier, setPendingTier] = useState<Tier | null>(null);
  const [confirmTier, setConfirmTier] = useState<Tier | null>(null);
  const [params, setParams] = useSearchParams();
  const syncedRef = useRef(false);

  // After returning from Stripe Checkout, reconcile server-side rather than
  // waiting for the webhook — then keep polling briefly as a safety net.
  useEffect(() => {
    if (params.get("checkout") !== "success" || syncedRef.current) return;
    syncedRef.current = true;
    const sessionId = params.get("session_id");
    trackTrialStart();
    params.delete("checkout");
    params.delete("session_id");
    setParams(params, { replace: true });

    let interval: number | undefined;
    (async () => {
      if (activeOrg) {
        try {
          await supabase.functions.invoke("stripe-sync-subscription", {
            body: { organizationId: activeOrg.organization_id, sessionId },
          });
        } catch (e) {
          console.error("[billing] sync failed", e);
        }
      }
      await refetch();
      toast.success("Subscription activated!");
      interval = window.setInterval(refetch, 3000);
      window.setTimeout(() => interval && clearInterval(interval), 20000);
    })();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [params, setParams, refetch, activeOrg]);

  useEffect(() => {
    if (params.get("checkout") === "cancelled") {
      toast("Checkout cancelled — no charge was made.");
      params.delete("checkout");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const startCheckout = async (target: Tier) => {
    if (!activeOrg) return;
    setPendingTier(target);
    try {
      await openCheckout({ plan: target, organizationId: activeOrg.organization_id });
    } finally {
      setPendingTier(null);
    }
  };

  const changePlan = async (target: Tier) => {
    if (!activeOrg) return;
    setPendingTier(target);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-change-plan", {
        body: { plan: target, organizationId: activeOrg.organization_id },
      });
      let message = error?.message;
      const context = (error as any)?.context;
      if (context instanceof Response) {
        try {
          message = (await context.clone().json())?.error ?? message;
        } catch { /* non-JSON body */ }
      }
      if (error) throw new Error(message ?? "Could not change plan");
      if (data?.effective === "period_end") {
        toast.success(
          `Downgrade to ${TIERS[target].name} scheduled — you keep your current plan until the period ends.`,
        );
      } else {
        toast.success(`You're now on ${TIERS[target].name}.`);
      }
      await refetch();
      window.setTimeout(refetch, 3000);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not change plan");
    } finally {
      setPendingTier(null);
      setConfirmTier(null);
    }
  };

  const onPlanClick = (target: Tier) => {
    if (!isOwner) {
      toast.error("Only the organization owner can manage billing.");
      return;
    }
    if (!isActive) return startCheckout(target);
    setConfirmTier(target);
  };

  const onManage = async () => {
    if (!activeOrg) return;
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-portal", {
        body: { organizationId: activeOrg.organization_id },
      });
      if (error || !data?.url) throw new Error(error?.message ?? "Failed to open portal");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open customer portal");
    } finally {
      setPortalLoading(false);
    }
  };

  const currentIdx = tier ? ORDER.indexOf(tier) : -1;
  const confirmIsUpgrade = confirmTier ? ORDER.indexOf(confirmTier) > currentIdx : false;

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
                      {subscription?.cancel_at_period_end
                        ? "Cancels at period end"
                        : subscription?.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    ${TIERS[tier].price} / month
                    {subscription?.current_period_end && (
                      <>
                        {" "}
                        · {subscription.cancel_at_period_end ? "ends" : "renews"}{" "}
                        {new Date(subscription.current_period_end).toLocaleDateString()}
                      </>
                    )}
                  </p>
                  {isTrialing && subscription?.trial_end && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Free trial — your first payment is on{" "}
                      {new Date(subscription.trial_end).toLocaleDateString()}.
                    </p>
                  )}
                  {scheduledTier && subscription?.scheduled_change_at && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Switching to {TIERS[scheduledTier].name} on{" "}
                      {new Date(subscription.scheduled_change_at).toLocaleDateString()}.
                    </p>
                  )}
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
                    {portalLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-2 h-4 w-4" />
                    )}
                    Manage subscription
                  </Button>
                )}
              </div>
            </Card>
          )}

          {!isActive && (
            <Card className="border-primary/40 bg-primary/5 p-4 text-sm">
              Your organization doesn't have an active subscription. Choose a plan below to start
              your 7-day free trial and unlock the FastTract office app.
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {ORDER.map((t) => {
              const plan = TIERS[t];
              const isCurrent = isActive && tier === t;
              const targetIdx = ORDER.indexOf(t);
              const action = !isActive
                ? "Start 7-day free trial"
                : isCurrent
                ? "Current plan"
                : targetIdx > currentIdx
                ? "Upgrade"
                : "Downgrade";

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
                    disabled={
                      isCurrent || !isOwner || ((checkoutLoading || !!pendingTier) && pendingTier === t)
                    }
                    onClick={() => onPlanClick(t)}
                  >
                    {pendingTier === t ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working…
                      </>
                    ) : (
                      action
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>
          {!isOwner && (
            <p className="text-xs text-muted-foreground">Ask your organization owner to change plans.</p>
          )}
        </>
      )}

      <AlertDialog open={!!confirmTier} onOpenChange={(o) => !o && setConfirmTier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmIsUpgrade ? "Upgrade" : "Downgrade"} to {confirmTier && TIERS[confirmTier].name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmIsUpgrade
                ? `Your new plan starts immediately. We'll charge a prorated amount for the rest of this billing period, then $${confirmTier ? TIERS[confirmTier].price : 0}/month.`
                : `You keep your current features until ${
                    subscription?.current_period_end
                      ? new Date(subscription.current_period_end).toLocaleDateString()
                      : "the end of this period"
                  }, then switch to $${confirmTier ? TIERS[confirmTier].price : 0}/month. No refund is issued for the current period.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!pendingTier}>Keep current plan</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!pendingTier}
              onClick={(e) => {
                e.preventDefault();
                if (confirmTier) changePlan(confirmTier);
              }}
            >
              {pendingTier ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
