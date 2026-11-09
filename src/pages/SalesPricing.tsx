import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { SALES_PLANS } from "@/lib/sales";
import { TRIAL_DAYS } from "@/lib/tiers";

export default function SalesPricing() {
  return <div className="min-h-screen bg-background">
    <header className="border-b"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <Logo /><Button asChild variant="outline"><Link to="/login">Sign in</Link></Button>
    </div></header>
    <SEO title="FastTract Plans | Contractor OS" description="Compare FastTract Basic, Pro, and Enterprise. Start with a 7-day free trial." path="/pricing" />
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-center text-4xl font-bold">One business. One FastTract plan.</h1>
      <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">Manage estimates, jobs, invoices, and field work in your FastTract app. Monthly or annual billing.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-3">{SALES_PLANS.map(plan =>
        <section key={plan.name} className="flex flex-col rounded-xl border bg-card p-7">
          <h2 className="text-xl font-semibold">{plan.name}</h2>
          <p className="mt-5 text-4xl font-bold">${plan.monthly}<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
          <p className="mt-2 text-sm text-muted-foreground">Or ${plan.yearly.toLocaleString()} / year</p>
          <p className="mt-6 flex-1 text-muted-foreground">{plan.description}</p>
          <Button asChild className="mt-8"><Link to={`/signup?plan=${plan.tier}`}>Start {TRIAL_DAYS}-day free trial</Link></Button>
        </section>
      )}</div>
      <p className="mt-8 text-center text-sm text-muted-foreground">Card required to start; you're charged when the trial ends unless you cancel. Questions? <Link to="/contact" className="underline">Contact us</Link>. Already a customer? <Link to="/login" className="underline">Sign in</Link>.</p>
    </main>
  </div>;
}
