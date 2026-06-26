import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { toast } from "sonner";

const FEATURES = [
  "Leads, customers & estimates",
  "Jobs, scheduling & crew management",
  "GPS-verified time tracking",
  "Boss-approved hours & job costing",
  "AI admin assistant",
  "Mobile field app",
  "Unlimited crew members",
  "Cancel anytime",
];

export default function Pricing() {
  const { user, activeOrg } = useAuth();
  const navigate = useNavigate();
  const { openCheckout, loading } = usePaddleCheckout();

  const onCta = async () => {
    if (!user) { navigate("/signup"); return; }
    if (!activeOrg) { navigate("/onboarding"); return; }
    if (activeOrg.role !== "owner") {
      toast.error("Only the organization owner can subscribe.");
      return;
    }
    try {
      await openCheckout({
        priceId: "contractor_os_pro_monthly",
        customerEmail: user.email ?? undefined,
        customData: { userId: user.id, orgId: activeOrg.organization_id },
      });
    } catch (e) {
      toast.error("Could not open checkout");
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Logo />
        <Button variant="ghost" asChild><Link to="/">Back</Link></Button>
      </header>
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">One plan. Everything you need.</h1>
          <p className="mt-3 text-muted-foreground">No per-seat surprises. Cancel anytime.</p>
        </div>
        <div className="mx-auto max-w-md rounded-xl border border-primary bg-card p-8 shadow-card ring-1 ring-primary">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Contractor OS Pro</h3>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-5xl font-semibold">$69</span>
            <span className="text-sm text-muted-foreground">/ month per company</span>
          </div>
          <ul className="mt-6 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>
          <Button className="mt-8 w-full" size="lg" onClick={onCta} disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening checkout…</> : user ? "Subscribe" : "Get started"}
          </Button>
        </div>
      </section>
    </div>
  );
}
