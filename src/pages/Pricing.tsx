import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";

const INCLUDED = [
  "Lead capture and customer follow-up",
  "Estimates, jobs, invoices, and payments",
  "Scheduling, conversations, and reviews",
  "AI assistance built around contractor workflows",
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <SEO title="FastTract Access" description="Request early access to FastTract, the contractor operating system that carries every job from the first call to final payment." path="/pricing" />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Logo />
        <Button variant="ghost" asChild><Link to="/">Back</Link></Button>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <span className="rounded-full border border-primary/25 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">Founding customer access</span>
        <h1 className="mt-7 text-4xl font-semibold tracking-tight sm:text-5xl">The right FastTract setup starts with your business.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">We are onboarding contractors personally while the final plans and provisioning flow are completed. No public price or trial promise will be shown until the full customer journey is ready.</p>
        <div className="mx-auto mt-10 max-w-xl rounded-2xl border bg-card p-8 text-left shadow-card">
          <h2 className="text-lg font-semibold">The operating system we are building includes</h2>
          <ul className="mt-5 space-y-4">
            {INCLUDED.map((feature) => (
              <li key={feature} className="flex gap-3 text-sm"><Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span>{feature}</span></li>
            ))}
          </ul>
          <Button className="mt-8 w-full" size="lg" asChild><Link to="/contact">Request early access</Link></Button>
        </div>
      </main>
    </div>
  );
}
