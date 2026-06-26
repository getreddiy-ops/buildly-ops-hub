import { DollarSign } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AgentPayouts() {
  return (
    <>
      <PageHeader title="Payouts" description="Your revenue share from client subscriptions." />
      <Card className="p-8 text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <DollarSign className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold">Stripe payouts coming soon</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Once Stripe billing is connected, you'll see your monthly revenue share, pending balance, and payout history here.
        </p>
        <Badge variant="outline">Phase 7</Badge>
      </Card>
    </>
  );
}
