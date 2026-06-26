import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
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
  const { user } = useAuth();
  const { subscription, isActive, isPastDue, loading, refetch } = useSubscription();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
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
    try {
      await openCheckout({
        priceId: "contractor_os_pro_monthly",
        customerEmail: user?.email ?? undefined,
        customData: { userId: user?.id ?? "" },
      });
    } catch (e) {
      toast.error("Could not open checkout");
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Billing" subtitle="Manage your Contractor OS subscription" />

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : isActive ? (
        <Card className="p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
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
                  <> · renews {new Date(subscription.current_period_end).toLocaleDateString()}</>
                )}
              </p>
              {isPastDue && (
                <p className="mt-2 text-sm text-destructive">
                  Your last payment failed. Please update your payment method to keep your subscription.
                </p>
              )}
            </div>
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
          <Button onClick={onSubscribe} disabled={checkoutLoading} size="lg" className="mt-8 w-full">
            {checkoutLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening checkout…</> : "Subscribe"}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground text-center">
            Cancel anytime. Keeps access until the end of your billing period.
          </p>
        </Card>
      )}
    </div>
  );
}
