import { Link } from "react-router-dom";
import { MarketingShell, CTARow } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import { Phone, Camera, Users, FileText, Receipt, Calendar, Clock, Bot } from "lucide-react";

const features = [
  { icon: Users, title: "Customers & Follow-up", to: "/contractor-crm", desc: "Keep leads, customers, calls, messages, and next steps together in one record." },
  { icon: FileText, title: "Estimates & Proposals", to: "/estimate-software", desc: "Create clear, branded proposals and request approval before anything is sent." },
  { icon: Receipt, title: "Money & Payments", to: "/invoice-software", desc: "Organize income, expenses, invoices, payments, tax reserves, and reports." },
  { icon: Calendar, title: "Scheduling & Reminders", to: "/signup", desc: "Coordinate appointments, work, follow-ups, and the personal details you do not want to forget." },
  { icon: Clock, title: "Work Tracking", to: "/signup", desc: "Track time, jobs, projects, and costs with workflows tailored to your business." },
  { icon: Camera, title: "Company & Team Setup", to: "/signup", desc: "Set up your company profile, invite the team, and organize documents and operating details." },
];

export default function Features() {
  return (
    <MarketingShell>
      <SEO
        title="Contractor OS Features — FastTract"
        description="Connect contractor customers, estimates, jobs, scheduling, crew time, invoices, and job costing in FastTract. AI is optional."
        path="/features"
      />
      <section className="mx-auto max-w-4xl px-4 pt-16 pb-10 text-center sm:px-6 lg:px-8 lg:pt-24">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          One Contractor OS for office and field work.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Keep customer records, estimates, scheduled jobs, crew hours, invoices, and costs connected. Core workflows do not depend on an AI provider.
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
