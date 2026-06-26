import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight, MapPin, Bot, FileText, Briefcase, Clock, DollarSign, ShieldCheck,
} from "lucide-react";

const features = [
  { icon: Briefcase, title: "Leads → Jobs", desc: "Push a lead through estimate, approval, and into a scheduled job." },
  { icon: MapPin, title: "GPS Time Tracking", desc: "Crew clocks in on-site. You see who's where, in real time." },
  { icon: ShieldCheck, title: "Boss-Approved Hours", desc: "Payroll only includes hours you've signed off on." },
  { icon: DollarSign, title: "Job Costing", desc: "Labor, materials, margin — per job, automatically." },
  { icon: Bot, title: "AI Admin Assistant", desc: "Draft estimates, follow-ups, and schedules. You approve before it acts." },
  { icon: FileText, title: "Customer CRM", desc: "Every call, message, and estimate in one place." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-dark text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
          <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild><Link to="/login">Sign in</Link></Button>
          <Button asChild><Link to="/signup">Start free</Link></Button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pt-16 pb-24 sm:px-6 lg:px-8 lg:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Built for crews that build
          </div>
          <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            Run your whole<br />
            <span className="text-gradient-primary">contracting business</span>
            <br />from one app.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            Leads, estimates, jobs, crew, GPS-verified hours, job costing, and an AI assistant that handles the paperwork — with you in control.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/signup">Start free <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-background/50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-semibold tracking-tight">Everything you stopped doing because it's a pain.</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-6 shadow-card">
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-medium">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <Clock className="mx-auto mb-4 h-8 w-8 text-primary" />
          <h2 className="text-3xl font-semibold tracking-tight">Stop guessing. Start running.</h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            One operating system for your office, your field crew, and your bottom line.
          </p>
          <Button size="lg" className="mt-8" asChild>
            <Link to="/signup">Create your account</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <Logo />
          <div>© {new Date().getFullYear()} Contractor OS</div>
        </div>
      </footer>
    </div>
  );
}
