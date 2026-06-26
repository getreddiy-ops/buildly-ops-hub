import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Loader2, ExternalLink } from "lucide-react";
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

const FEATURES = [
  "Leads, customers & estimates",
  "Jobs, scheduling & crew management",
  "GPS-verified time tracking",
  "Boss-approved hours & job costing",
  "AI admin assistant",
  "Mobile field app",
];

export default function Billing() {
  const { user, activeOrg } = useAuth();
  const { subscription, isActive, isPastDue, isOwner, loading, refetch } = useSubscription();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const [portalLoading, setPortalLoading] = useState(false);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get("checkout") === "success") {
      toast.success("Subscription activated — welcome to Pro!");
      const t = setInterval(() => refetch(), 2000);
      const stop = setTimeout(() => clearInterval(t), 15000);
      params.delete("checkout");
      setParams(params, { replace: true });
      return () => { clearInterval(t); clearTimeout(stop); };
    }
  }, [params, setParams, refetch]);

  const onSubscribe = async () => {
    if (!activeOrg) return;
    if (!isOwner) {
      toast.error("Only the organization owner can subscribe.");
      return;
    }
    try {
      await openCheckout({
        priceId: "contractor_os_pro_monthly",
        customerEmail: user?.email ?? undefined,
        customData: { userId: user?.id ?? "", orgId: activeOrg.organization_id },
      });
    } catch (e) {
      toast.error("Could not open checkout");
      console.error(e);
    }
  };

  const onManage = async () => {
    if (!activeOrg) return;
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("paddle-customer-portal", {
        body: {
          organizationId: activeOrg.organization_id,
          environment: getPaddleEnvironment(),
        },
      });
      if (error || !data?.url) throw new Error(error?.message ?? "Failed to open portal");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open customer portal");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Billing" description="Manage your Contractor OS subscription" />

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : isActive ? (
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Contractor OS Pro</h3>
                <Badge variant={isPastDue ? "destructive" : "default"}>
                  {subscription?.cancel_at_period_end ? "Cancels at period end" : subscription?.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                $69 / month
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
      ) : (
        <Card className="p-8 max-w-xl">
          <Badge>Recommended</Badge>
          <h3 className="mt-3 text-2xl font-semibold">Contractor OS Pro</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-semibold">$69</span>
            <span className="text-muted-foreground">/ month</span>
          </div>
          <ul className="mt-6 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 text-primary shrink-0" /> {f}
              </li>
            ))}
          </ul>
          <Button
            onClick={onSubscribe}
            disabled={checkoutLoading || !isOwner}
            size="lg"
            className="mt-8 w-full"
          >
            {checkoutLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening checkout…</> : "Subscribe"}
          </Button>
          {!isOwner && (
            <p className="mt-3 text-xs text-muted-foreground text-center">
              Ask your organization owner to subscribe.
            </p>
          )}
          {isOwner && (
            <p className="mt-3 text-xs text-muted-foreground text-center">
              Cancel anytime. Keeps access until the end of your billing period.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
