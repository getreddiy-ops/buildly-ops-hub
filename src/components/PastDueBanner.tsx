import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

export function PastDueBanner() {
  const { isPastDue } = useSubscription();
  if (!isPastDue) return null;
  return (
    <div className="w-full bg-destructive/15 border-b border-destructive/40 px-4 py-2 text-center text-sm text-destructive">
      <AlertTriangle className="mr-2 inline h-4 w-4 align-text-bottom" />
      Your last payment failed.{" "}
      <Link to="/app/billing" className="font-medium underline">
        Update your payment method
      </Link>{" "}
      to keep Contractor OS Pro.
    </div>
  );
}
