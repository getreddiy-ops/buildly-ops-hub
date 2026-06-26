import { Link } from "react-router-dom";
import { MarketingShell, CTARow } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import { FAQ } from "@/components/marketing/FAQ";
import { Button } from "@/components/ui/button";

export default function AIPhoneAgent() {
  return (
    <MarketingShell>
      <SEO
        title="AI Phone Answering for Contractors | 24/7 Receptionist — ContractorOS"
        description="ContractorOS answers contractor calls 24/7, captures lead details, books appointments, fills out CRM forms by voice, and writes everything back to your CRM. Stop missing leads while you’re on the job."
        path="/ai-phone-agent"
      />
      <section className="mx-auto max-w-4xl px-4 pt-16 pb-10 text-center sm:px-6 lg:px-8 lg:pt-24">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          AI Phone Answering for Contractors
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          You get a dedicated phone number. The AI Phone Agent answers every call, captures the lead, books estimate appointments, and sends you a summary by text — 24/7.
        </p>
        <CTARow />
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          {[
            { t: "Never miss another lead", d: "Most missed calls don’t leave voicemail. The AI Phone Agent picks up every time — including nights and weekends." },
            { t: "Books appointments", d: "Reads your calendar and books estimate slots in real time, then notifies you." },
            { t: "Captures lead details", d: "Name, address, scope, timeline, and budget — all written into your CRM automatically." },
            { t: "Trained on your business", d: "Knows your services, pricing range, and service area. Speaks the way you’d want." },
          ].map((b) => (
            <div key={b.t} className="rounded-xl border border-border bg-card/60 p-6">
              <h3 className="text-lg font-semibold">{b.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10 text-center sm:px-6 lg:px-8">
        <Button size="lg" asChild><Link to="/signup">Get my AI phone number</Link></Button>
      </section>

      <FAQ
        items={[
          { q: "Do I get a real phone number?", a: "Yes. ContractorOS provisions a local or toll-free number for your business. You can also forward your existing line." },
          { q: "Will it sound robotic?", a: "No. It uses a natural-sounding voice and is trained on your business — services, pricing range, and tone." },
          { q: "What if it can’t answer something?", a: "It captures the question, creates the lead, and sends you a summary so you can follow up." },
          { q: "Does it work with my CRM?", a: "It writes calls and leads directly into the ContractorOS CRM. Every call is on the customer record." },
        ]}
      />
    </MarketingShell>
  );
}
