import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { FASTTRACT_BILLING_MAILTO, FASTTRACT_SALES_MAILTO } from "@/lib/sales";
import { isNativeApp } from "@/lib/native";

export default function PlanBilling() {
  const { isActive, loading, refetch } = useSubscription();
  return <div className="space-y-6">
    <PageHeader title="Plan & billing" description="Online billing management is coming soon." />
    <Card className="space-y-4 p-6">
      <h2 className="text-xl font-semibold">Already a FastTract customer?</h2>
      <p className="text-muted-foreground">Your subscription stays active. For renewals, payment details, or plan changes, contact us and we'll take care of it.</p>
      {isActive && <p className="text-sm">An active app access record is available for this company.</p>}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" disabled={loading} onClick={() => void refetch()}>Check app access</Button>
        <Button asChild><a href={FASTTRACT_BILLING_MAILTO}>Get billing or access help</a></Button>
      </div>
    </Card>
    {!isNativeApp() && <Card className="space-y-4 p-6">
      <h2 className="text-lg font-semibold">New to FastTract?</h2>
      <p className="text-muted-foreground">Compare Basic, Pro, and Enterprise, then contact us to get set up.</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline"><Link to="/pricing">Compare plans</Link></Button>
        <Button asChild><a href={FASTTRACT_SALES_MAILTO}>Contact us</a></Button>
      </div>
    </Card>}
  </div>;
}
