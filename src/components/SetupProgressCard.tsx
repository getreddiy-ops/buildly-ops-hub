import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Rocket, X } from "lucide-react";
import { useSetupFacts } from "@/hooks/useSetupFacts";
import { computeProgress, isCardDismissed, loadManual, setCardDismissed } from "@/lib/setup-guide";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

/** Overview card that points new owners at the Getting started guide until setup is done. */
export function SetupProgressCard({ orgId }: { orgId: string }) {
  const facts = useSetupFacts(orgId);
  const [dismissed, setDismissed] = useState(() => isCardDismissed(orgId));
  const progress = useMemo(() => computeProgress(facts, loadManual(orgId)), [facts, orgId]);

  if (!facts || dismissed || progress.allRequiredDone) return null;

  return (
    <Card className="relative p-5">
      <button
        type="button"
        aria-label="Hide setup guide"
        onClick={() => { setCardDismissed(orgId, true); setDismissed(true); }}
        className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-secondary"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-col gap-4 pr-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="font-semibold">Finish setting up FastTract</div>
            <div className="text-sm text-muted-foreground">
              {progress.doneRequired} of {progress.totalRequired} done.{progress.next ? ` Next: ${progress.next.title.toLowerCase()}.` : ""}
            </div>
            <Progress value={progress.percent} className="mt-2 h-2 max-w-xs" />
          </div>
        </div>
        <Button asChild className="shrink-0"><Link to="/app/getting-started">Continue setup <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
      </div>
    </Card>
  );
}
