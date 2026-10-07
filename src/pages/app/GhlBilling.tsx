import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { FASTTRACT_CHECKOUT_URL } from "@/lib/sales";

export default function GhlBilling() {
  const { isActive, loading, refetch } = useSubscription();
  return <div className="space-y-6">
    <PageHeader title="Plan & billing" description="Your FastTract subscription stays with your existing billing account." />
    <Card className="space-y-4 p-6">
      <h2 className="text-xl font-semibold">Already purchased FastTract?</h2>
      <p className="text-muted-foreground">Keep the subscription you purchased through FastTract's checkout. Renewals, payment details, and plan changes are managed through your original customer portal.</p>
      <p className="font-medium">Do not purchase a second subscription to unlock this app.</p>
      {isActive && <p className="text-sm">An active app access record is available for this company.</p>}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" disabled={loading} onClick={() => void refetch()}>Check app access</Button>
        <Button asChild><a href="mailto:getreddiy@gmail.com?subject=FastTract%20subscription%20and%20app%20access">Get billing or access help</a></Button>
      </div>
      <p className="text-sm text-muted-foreground">If your purchase is not reflected here, support will verify the original subscription and connect your company access.</p>
    </Card>
    <Card className="space-y-4 p-6">
      <h2 className="text-lg font-semibold">New to FastTract?</h2>
      <p className="text-muted-foreground">Compare Basic, Pro, and Enterprise, then choose your plan at our existing secure checkout.</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline"><Link to="/pricing">Compare plans</Link></Button>
        <Button asChild><a href={FASTTRACT_CHECKOUT_URL}>Open secure checkout</a></Button>
      </div>
    </Card>
  </div>;
}
