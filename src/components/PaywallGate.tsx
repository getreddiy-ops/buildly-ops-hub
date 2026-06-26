import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSubscription } from "@/hooks/useSubscription";

export function PaywallGate({ children, feature }: { children: React.ReactNode; feature: string }) {
  const { isActive, loading } = useSubscription();
  if (loading) return null;
  if (isActive) return <>{children}</>;
  return (
    <div className="p-6">
      <Card className="mx-auto max-w-xl p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold">{feature} is a Pro feature</h2>
        <p className="mt-2 text-muted-foreground">
          Upgrade to Contractor OS Pro to unlock {feature.toLowerCase()} and the full suite.
        </p>
        <Button asChild className="mt-6">
          <Link to="/app/billing">Upgrade to Pro</Link>
        </Button>
      </Card>
    </div>
  );
}
