import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useStripeBilling } from "@/hooks/useStripeBilling";
import { isNativeApp } from "@/lib/native";
import { FASTTRACT_BILLING_MAILTO } from "@/lib/sales";
import { PLAN_NAMES, TIER_DESCRIPTIONS, TIER_ORDER, TRIAL_DAYS, planPrice, type BillingInterval } from "@/lib/tiers";

const STATUS_LABEL: Record<string, string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment past due",
  canceled: "Canceled",
};

function formatDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : null;
}

export default function PlanBilling() {
  const { activeOrg } = useAuth();
  const { subscription, isActive, isOwner, tier, loading, refetch } = useSubscription();
  const { startCheckout, openPortal, loading: busy } = useStripeBilling();
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [params, setParams] = useSearchParams();
  const native = isNativeApp();
  const orgId = activeOrg?.organization_id ?? null;

  useEffect(() => {
    const result = params.get("checkout");
    if (!result) return;
    if (result === "success") {
      toast.success("You're all set. Your FastTract plan is starting.");
      void refetch();
    }
    params.delete("checkout");
    setParams(params, { replace: true });
  }, [params, setParams, refetch]);

  const run = async (fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { toast.error((e as Error).message); }
  };

  const managedByStripe = subscription?.billing_provider === "stripe";
  const periodEnd = formatDate(subscription?.current_period_end);

  return <div className="space-y-6">
    <PageHeader title="Plan & billing" description="Your FastTract subscription." />

    {!loading && isActive && tier && <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">{PLAN_NAMES[tier]}</h2>
        <span className="text-sm font-medium text-muted-foreground">{STATUS_LABEL[subscription?.status ?? ""] ?? subscription?.status}</span>
      </div>
      {periodEnd && <p className="text-muted-foreground">
        {subscription?.status === "trialing" ? `Trial ends ${periodEnd}.` : subscription?.cancel_at_period_end ? `Ends ${periodEnd}; it won't renew.` : `Renews ${periodEnd}.`}
      </p>}
      {subscription?.billing_provider === "internal" && <p className="text-sm text-muted-foreground">This plan was set up for you by FastTract, so there's nothing to pay here.</p>}
      <div className="flex flex-wrap gap-3">
        {managedByStripe && isOwner && !native && <Button disabled={busy !== null || !orgId} onClick={() => orgId && run(() => openPortal(orgId))}>
          {busy === "portal" ? "Opening…" : "Change plan, card or invoices"}
        </Button>}
        <Button variant="outline" asChild><a href={FASTTRACT_BILLING_MAILTO}>Billing help</a></Button>
      </div>
      {managedByStripe && !isOwner && <p className="text-sm text-muted-foreground">Only the business owner can change the plan.</p>}
    </Card>}

    {!loading && !isActive && native && <Card className="space-y-3 p-6">
      <h2 className="text-xl font-semibold">No active FastTract plan</h2>
      <p className="text-muted-foreground">Plans are managed on the web at fasttract.org. If you already have one, refresh to check again.</p>
      <Button variant="outline" onClick={() => void refetch()}>Check again</Button>
    </Card>}

    {!loading && !isActive && !native && <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Choose your plan</h2>
          <p className="text-muted-foreground">{subscription ? "Pick a plan to keep using FastTract." : `${TRIAL_DAYS}-day free trial. Your card is charged when the trial ends, and you can cancel before then.`}</p>
        </div>
        <div className="inline-flex rounded-lg border p-1" role="group" aria-label="Billing period">
          {(["month", "year"] as const).map((value) => <Button key={value} size="sm" variant={interval === value ? "default" : "ghost"} aria-pressed={interval === value} onClick={() => setInterval(value)}>
            {value === "month" ? "Monthly" : "Yearly (2 months free)"}
          </Button>)}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {TIER_ORDER.map((t) => {
          const price = planPrice(t, interval);
          return <Card key={t} className="flex flex-col gap-3 p-6">
            <h3 className="text-lg font-semibold">{PLAN_NAMES[t]}</h3>
            <p className="text-3xl font-bold">${price.amount.toLocaleString()}<span className="text-sm font-normal text-muted-foreground"> / {interval}</span></p>
            <p className="flex-1 text-sm text-muted-foreground">{TIER_DESCRIPTIONS[t]}</p>
            {isOwner
              ? <Button disabled={busy !== null || !orgId} onClick={() => orgId && run(() => startCheckout(orgId, price.priceId))}>
                  {busy === "checkout" ? "Opening checkout…" : subscription ? "Choose plan" : "Start free trial"}
                </Button>
              : <p className="text-sm text-muted-foreground">Ask the business owner to choose a plan.</p>}
          </Card>;
        })}
      </div>
      <p className="text-sm text-muted-foreground">Payments are handled securely by Stripe. See our <Link className="underline" to="/legal/terms">terms</Link> and <Link className="underline" to="/legal/refunds">refund policy</Link>.</p>
    </section>}
  </div>;
}
