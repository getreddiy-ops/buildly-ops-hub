import { Link } from "react-router-dom";
import { MarketingShell, CTARow } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import { Phone, Camera, Users, FileText, Receipt, Calendar, Clock, Bot } from "lucide-react";

const features = [
  { icon: Bot, title: "Your Personal AI Assistant", to: "/signup", desc: "Talk naturally with Ava. She learns your approved business context and helps you handle the work without hunting through menus." },
  { icon: Phone, title: "24/7 Phone Assistant", to: "/ai-phone-agent", desc: "Answer missed calls, capture customer details, and prepare follow-up around the clock." },
  { icon: Users, title: "Customers & Follow-up", to: "/contractor-crm", desc: "Keep leads, customers, calls, messages, and next steps together in one record." },
  { icon: FileText, title: "Estimates & Proposals", to: "/estimate-software", desc: "Create clear, branded proposals and request approval before anything is sent." },
  { icon: Receipt, title: "Money & Payments", to: "/invoice-software", desc: "Organize income, expenses, invoices, payments, tax reserves, and reports." },
  { icon: Calendar, title: "Scheduling & Reminders", to: "/signup", desc: "Coordinate appointments, work, follow-ups, and the personal details you do not want to forget." },
  { icon: Clock, title: "Work Tracking", to: "/signup", desc: "Track time, jobs, projects, and costs with workflows tailored to your business." },
  { icon: Camera, title: "Website & Brand Setup", to: "/signup", desc: "Share your website and Ava can pull in your logo and colors, then suggest a stronger web presence." },
];

export default function Features() {
  return (
    <MarketingShell>
      <SEO
        title="Features | Your Personal AI Business Assistant — FastTract"
        description="Meet Ava and explore FastTract’s four connected areas: Home, Work, Money, and Business—personalized for the way your company operates."
        path="/features"
      />
      <section className="mx-auto max-w-4xl px-4 pt-16 pb-10 text-center sm:px-6 lg:px-8 lg:pt-24">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          One AI assistant for the whole business.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Ava helps you manage customers, work, money, and company operations through one simple conversation. Contractor workflows are included, but FastTract adapts to any kind of business.
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
