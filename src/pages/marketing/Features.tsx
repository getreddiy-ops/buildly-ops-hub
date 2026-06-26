import { Link } from "react-router-dom";
import { MarketingShell, CTARow } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import { Phone, Camera, Users, FileText, Receipt, Calendar, Clock, Bot } from "lucide-react";

const features = [
  { icon: Phone, title: "AI Phone Answering for Contractors", to: "/ai-phone-agent", desc: "An AI receptionist answers every missed call, captures lead details, and books appointments 24/7." },
  { icon: Camera, title: "AI Photo Estimating", to: "/ai-photo-estimator", desc: "Customers or crews upload photos. AI drafts a rough estimate using your unit pricing." },
  { icon: Users, title: "Contractor CRM", to: "/contractor-crm", desc: "Every lead, customer, call, text, and job history in one record." },
  { icon: FileText, title: "Estimates & Proposals", to: "/estimate-software", desc: "Branded proposals with e-signature, converted to jobs in one click." },
  { icon: Receipt, title: "Invoices & Payments", to: "/invoice-software", desc: "Deposit, progress, and final invoices with online payment links." },
  { icon: Calendar, title: "Job Scheduling", to: "/features", desc: "Crew and sub scheduling across every active job." },
  { icon: Clock, title: "Crew Time Tracking", to: "/features", desc: "GPS-verified clock-in, boss-approved hours, and job-costed payroll." },
  { icon: Bot, title: "AI Command Chat", to: "/features", desc: "Run the whole business by typing or talking — AI fills forms, drafts estimates, and creates jobs while you confirm before it writes." },
];

export default function Features() {
  return (
    <MarketingShell>
      <SEO
        title="Features | Contractor Software for Estimating, CRM, Jobs & Invoicing — ContractorOS"
        description="See every feature in ContractorOS: AI phone answering, AI photo estimating, voice-driven AI form filling, contractor CRM, estimates, invoices, job scheduling, crew time tracking, and an AI command chat."
        path="/features"
      />
      <section className="mx-auto max-w-4xl px-4 pt-16 pb-10 text-center sm:px-6 lg:px-8 lg:pt-24">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Every tool a contractor needs — in one app.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          ContractorOS is the AI-powered operating system for contractors. Answer calls, capture leads, estimate from photos and voice, schedule crews, track time, send invoices, and collect payments.
        </p>
        <CTARow />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Link key={f.title} to={f.to} className="rounded-xl border border-border bg-card/60 p-6 transition hover:border-primary">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
