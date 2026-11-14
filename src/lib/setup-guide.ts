/**
 * Getting-started checklist for a new FastTract business.
 *
 * Steps are ordered the way a contractor actually sets up: who you are, what you
 * charge, then one full lead -> estimate -> job -> time -> invoice loop.
 * Completion is detected from real data (see useSetupFacts); any step can also be
 * marked done by hand, which is stored per business in localStorage.
 */

export type SetupFacts = {
  hasProfile: boolean;
  hasLogo: boolean;
  materials: number;
  customers: number;
  estimates: number;
  jobs: number;
  crewInvites: number;
  timeEntries: number;
  invoices: number;
  cardPayments: boolean;
};

export type SetupStepId =
  | "profile" | "branding" | "materials" | "customer" | "estimate"
  | "job" | "crew" | "time" | "invoice" | "payments" | "quickbooks";

export type SetupStep = {
  id: SetupStepId;
  title: string;
  why: string;
  how: string[];
  to: string;
  cta: string;
  minutes: number;
  optional?: boolean;
  /** Detects completion from data. Steps without it can only be checked off by hand. */
  done?: (f: SetupFacts) => boolean;
};

export const SETUP_STEPS: SetupStep[] = [
  {
    id: "profile", title: "Fill in your business profile", minutes: 3,
    why: "Your name, phone and address print on every estimate and invoice, and Ask AI uses them when it drafts for you.",
    how: ["Open Business profile.", "Enter your legal name, phone, email, address and license or tax ID.", "Save."],
    to: "/app/business-profile", cta: "Open business profile",
    done: (f) => f.hasProfile,
  },
  {
    id: "branding", title: "Add your logo and document style", minutes: 3,
    why: "Customers judge a bid by how it looks. Your logo and colors go on every PDF and customer link.",
    how: ["Open Brand & documents.", "Upload your logo (PNG or JPG).", "Pick your brand color and default terms, then preview a document."],
    to: "/app/branding", cta: "Open brand & documents",
    done: (f) => f.hasLogo,
  },
  {
    id: "materials", title: "Build your price list", minutes: 10,
    why: "Saved materials and labor rates turn a 30-minute estimate into a 3-minute one, and they keep job costing honest.",
    how: ["Open Materials.", "Press New material and add the items you quote most: concrete per yard, rebar, forms, labor per hour.", "Set a unit and your price for each. You can edit them any time."],
    to: "/app/materials", cta: "Open materials",
    done: (f) => f.materials >= 3,
  },
  {
    id: "customer", title: "Add your first customer", minutes: 2,
    why: "Everything (estimates, jobs, messages, invoices) hangs off a customer, so their history stays in one place.",
    how: ["Open Customers and press New customer.", "Enter a name plus a phone or email, and the job address.", "Tip: new inquiries go in Leads first, then convert when they're real."],
    to: "/app/customers", cta: "Open customers",
    done: (f) => f.customers > 0,
  },
  {
    id: "estimate", title: "Send your first estimate", minutes: 5,
    why: "Customers approve from a link on their phone, and you see when they've opened it.",
    how: ["Open Estimates and create one for your customer.", "Add lines from your price list, or use Photo estimate to draft from job-site photos.", "Press Send. The customer gets a link to review and approve."],
    to: "/app/estimates", cta: "Open estimates",
    done: (f) => f.estimates > 0,
  },
  {
    id: "job", title: "Turn the work into a job folder", minutes: 2,
    why: "A job folder holds the schedule, crew, photos, time, costs and paperwork for one project.",
    how: ["Open an approved estimate and press Convert to job, or create a job in Job folders.", "Set the start date so it shows on the Calendar and your Overview."],
    to: "/app/jobs", cta: "Open job folders",
    done: (f) => f.jobs > 0,
  },
  {
    id: "crew", title: "Invite your crew", minutes: 3,
    why: "Workers get a simple field app with their jobs and a clock-in button. They're kept out of the office side: estimates, invoices and settings.",
    how: ["Open People & crew and press Invite member.", "Enter each person's email and pick their role: worker for the field, admin for the office.", "They accept from the email and land in the field app."],
    to: "/app/crew", cta: "Open people & crew",
    done: (f) => f.crewInvites > 0,
  },
  {
    id: "time", title: "Track time on a job", minutes: 2,
    why: "Hours tied to jobs give you real labor cost per project and make payroll a review, not a hunt.",
    how: ["Crew press Clock in on their phone when they start, and Clock out when they leave.", "Or add hours yourself in Time tracking.", "Approve entries in Approvals each week."],
    to: "/app/time", cta: "Open time tracking",
    done: (f) => f.timeEntries > 0,
  },
  {
    id: "invoice", title: "Send your first invoice", minutes: 3,
    why: "Invoices pull from the job, so nothing gets missed, and overdue ones show up on your Overview.",
    how: ["Open Invoices and create one for the job.", "Check the lines and the due date.", "Press Send. Record payments as they come in."],
    to: "/app/invoices", cta: "Open invoices",
    done: (f) => f.invoices > 0,
  },
  {
    id: "payments", title: "Take deposits by card", minutes: 5, optional: true,
    why: "Customers can pay the deposit by card right from the estimate link, straight to your bank. Jobs start sooner.",
    how: ["Open Settings and find Customer payments.", "Press Connect Stripe and finish Stripe's verification (bank account and ID).", "Once Stripe turns on charges, approved estimates show a Pay deposit button."],
    to: "/app/settings", cta: "Open settings",
    done: (f) => f.cardPayments,
  },
  {
    id: "quickbooks", title: "Connect QuickBooks", minutes: 3, optional: true,
    why: "If your books live in QuickBooks Online, sent and paid invoices copy over on their own, so nobody keys them twice.",
    how: ["Open Settings and find QuickBooks.", "Press Connect QuickBooks and sign in to Intuit as a company admin.", "That's it. Sent and paid invoices copy to QuickBooks automatically."],
    to: "/app/settings", cta: "Open settings",
  },
];

export type StepState = SetupStep & { complete: boolean; auto: boolean };

export function computeProgress(facts: SetupFacts | null, manual: ReadonlySet<string>) {
  const steps: StepState[] = SETUP_STEPS.map((step) => {
    const auto = !!(facts && step.done?.(facts));
    return { ...step, auto, complete: auto || manual.has(step.id) };
  });
  const required = steps.filter((s) => !s.optional);
  const doneRequired = required.filter((s) => s.complete).length;
  return {
    steps,
    doneRequired,
    totalRequired: required.length,
    percent: Math.round((doneRequired / required.length) * 100),
    next: steps.find((s) => !s.complete && !s.optional) ?? steps.find((s) => !s.complete) ?? null,
    allRequiredDone: doneRequired === required.length,
  };
}

const key = (orgId: string, name: string) => `fasttract.setup.${name}.${orgId}`;

export function loadManual(orgId: string): Set<string> {
  try {
    const raw = localStorage.getItem(key(orgId, "manual"));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveManual(orgId: string, ids: Set<string>) {
  try { localStorage.setItem(key(orgId, "manual"), JSON.stringify([...ids])); } catch { /* storage unavailable */ }
}

export function isCardDismissed(orgId: string) {
  try { return localStorage.getItem(key(orgId, "dismissed")) === "1"; } catch { return false; }
}

export function setCardDismissed(orgId: string, dismissed: boolean) {
  try {
    if (dismissed) localStorage.setItem(key(orgId, "dismissed"), "1");
    else localStorage.removeItem(key(orgId, "dismissed"));
  } catch { /* storage unavailable */ }
}
