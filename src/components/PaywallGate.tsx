import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useSubscription } from "@/hooks/useSubscription";
import { type Tier } from "@/lib/tiers";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Gates UI behind a minimum subscription tier.
 * `requires` = the lowest tier that unlocks the feature.
 */
export function PaywallGate({
  children,
  feature,
  requires = "plus",
}: {
  children: React.ReactNode;
  feature: string;
  requires?: Tier;
}) {
  const { isPlatformAdmin } = useAuth();
  const { isActive, tier, loading } = useSubscription();
  if (loading) return null;

  // Platform owners need to be able to validate paid features without creating
  // a customer subscription for their own support account. The edge function
  // independently verifies this role before granting the same bypass.
  if (isPlatformAdmin) return <>{children}</>;

  const order: Tier[] = ["base", "plus", "premium"];
  const meets = isActive && tier && order.indexOf(tier) >= order.indexOf(requires);
  if (meets) return <>{children}</>;

  return (
    <div className="p-6">
      <Card className="mx-auto max-w-xl p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold">{feature} is optional</h2>
        <p className="mt-2 text-muted-foreground">
          {feature} is not part of the FastTract core launch plan. Your customer, estimate, job, scheduling, and crew workflows work without AI. Bring-your-own AI connections are planned for later.
        </p>
      </Card>
    </div>
  );
}
