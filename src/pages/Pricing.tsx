import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Starter",
    price: "$0",
    period: "free while in beta",
    features: ["Up to 3 crew", "Leads & customers", "Estimates", "GPS time tracking", "Mobile field app"],
    cta: "Start free",
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month per company",
    features: ["Unlimited crew", "Job costing", "Boss-approved hours", "AI admin assistant", "Customer messaging"],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Agency",
    price: "Contact",
    period: "for resellers & networks",
    features: ["Manage multiple client orgs", "White-label", "Revenue share", "Priority support"],
    cta: "Talk to us",
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Logo />
        <Button variant="ghost" asChild><Link to="/">Back</Link></Button>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Simple pricing.</h1>
          <p className="mt-3 text-muted-foreground">No per-seat surprises. Cancel anytime.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`rounded-xl border bg-card p-8 shadow-card ${
                t.highlight ? "border-primary ring-1 ring-primary" : "border-border"
              }`}
            >
              <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t.name}</h3>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-semibold">{t.price}</span>
                <span className="text-sm text-muted-foreground">{t.period}</span>
              </div>
              <ul className="mt-6 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button className="mt-8 w-full" variant={t.highlight ? "default" : "outline"} asChild>
                <Link to="/signup">{t.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
