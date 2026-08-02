import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { TIERS, type Tier } from "@/lib/tiers";

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
  const { isActive, tier, loading } = useSubscription();
  if (loading) return null;

  const order: Tier[] = ["base", "plus", "premium"];
  const meets = isActive && tier && order.indexOf(tier) >= order.indexOf(requires);
  if (meets) return <>{children}</>;

  const required = TIERS[requires];
  return (
    <div className="p-6">
      <Card className="mx-auto max-w-xl p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold">{feature} requires {required.name}</h2>
        <p className="mt-2 text-muted-foreground">
          Start a 7-day free trial of {required.name} (${required.price}/mo after) to unlock {feature.toLowerCase()}.
        </p>
        <Button asChild className="mt-6">
          <Link to="/app/billing">Start free trial</Link>
        </Button>
      </Card>
    </div>
  );
}
