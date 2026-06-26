import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { ArrowRight, Users, MessageSquare, FileText, Phone, ClipboardList, Clock } from "lucide-react";

const benefits = [
  { icon: Users, title: "Every lead in one pipeline", desc: "Capture leads from web forms, calls, and referrals. Move them from inquiry to estimate to job without spreadsheets." },
  { icon: MessageSquare, title: "Centralized customer communication", desc: "Calls, texts, emails, and on-site notes attached to the right customer — visible to your whole crew." },
  { icon: FileText, title: "Estimates that become contracts", desc: "Send branded estimates, capture e-signatures, and convert approved estimates into scheduled jobs in one click." },
  { icon: Phone, title: "AI phone answering for missed calls", desc: "An AI receptionist captures leads 24/7, books appointments, and writes the conversation back into the CRM." },
  { icon: ClipboardList, title: "Job history on every customer", desc: "See past jobs, photos, change orders, invoices, and payments on a single customer record." },
  { icon: Clock, title: "Built around field work", desc: "Designed for contractors — not retrofitted from a generic sales CRM. Crews use the mobile app on-site." },
];

export default function ContractorCRM() {
  return (
    <div className="min-h-screen bg-gradient-dark text-foreground">
      <SEO
        title="CRM for Contractors — Contractor OS"
        description="A CRM built for contractors: lead pipelines, customer communication, estimates, job history, and AI phone answering — all in one app."
        path="/features/contractor-crm"
      />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
          <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
        </nav>
        <Button asChild><Link to="/signup">Start free</Link></Button>
      </header>

      <section className="mx-auto max-w-4xl px-4 pt-16 pb-12 text-center sm:px-6 lg:px-8 lg:pt-24">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          The CRM built for <span className="text-gradient-primary">contractors</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Stop juggling spreadsheets, sticky notes, and three different inboxes. Contractor OS centralizes every lead,
          customer, estimate, and job — so nothing slips through the cracks.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/signup">Start free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button size="lg" variant="outline" asChild><Link to="/pricing">See pricing</Link></Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">What you get</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.title} className="rounded-xl border border-border bg-card/60 p-6 shadow-card">
              <b.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-medium">{b.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight">Why contractors choose Contractor OS over a generic CRM</h2>
        <p className="mt-4 text-muted-foreground">
          Generic CRMs are built for inside sales teams. Contractor OS is built around field work: GPS-verified
          clock-ins, boss-approved hours, job costing, and an AI assistant that drafts estimates and answers your
          phone — all tied to the same customer record.
        </p>
        <div className="mt-8">
          <Button size="lg" asChild><Link to="/signup">Try it free</Link></Button>
        </div>
      </section>
    </div>
  );
}
