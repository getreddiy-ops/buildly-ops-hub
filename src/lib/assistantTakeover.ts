export const TAKEOVER_ROUTES = [
  { path: "/app", label: "Dashboard" },
  { path: "/app/leads", label: "Leads" },
  { path: "/app/customers", label: "Customers" },
  { path: "/app/estimates", label: "Estimates" },
  { path: "/app/invoices", label: "Invoices" },
  { path: "/app/contracts", label: "Contracts" },
  { path: "/app/jobs", label: "Jobs" },
  { path: "/app/crew", label: "Crew" },
  { path: "/app/time", label: "Time Tracking" },
  { path: "/app/approvals", label: "Approvals" },
  { path: "/app/costing", label: "Job Costing" },
  { path: "/app/vendors", label: "Vendors" },
  { path: "/app/materials", label: "Materials" },
  { path: "/app/calendar", label: "Calendar" },
  { path: "/app/assistant", label: "AI Assistant" },
  { path: "/app/phone-assistant", label: "Phone Assistant" },
  { path: "/app/billing", label: "Billing" },
  { path: "/app/business-profile", label: "Business Profile" },
  { path: "/app/branding", label: "Branding" },
  { path: "/app/settings", label: "Settings" },
] as const;

export type TakeoverRoute = (typeof TAKEOVER_ROUTES)[number]["path"];

export type FastTractScreenContext = {
  path: string;
  title: string;
  visibleControls: string[];
};

export function resolveTakeoverRoute(path: string) {
  return TAKEOVER_ROUTES.find((route) => route.path === path) ?? null;
}

const TAKEOVER_ROUTE_TERMS: ReadonlyArray<{ path: TakeoverRoute; terms: readonly string[] }> = [
  { path: "/app/phone-assistant", terms: ["phone assistant", "ai phone", "phone agent"] },
  { path: "/app/business-profile", terms: ["business profile", "company profile"] },
  { path: "/app/assistant", terms: ["ai assistant", "ava", "assistant"] },
  { path: "/app/costing", terms: ["job costing", "costing"] },
  { path: "/app/time", terms: ["time tracking", "timesheets", "time"] },
  { path: "/app/approvals", terms: ["approvals", "approval"] },
  { path: "/app/customers", terms: ["customers", "customer"] },
  { path: "/app/estimates", terms: ["estimates", "estimate", "quotes", "quote"] },
  { path: "/app/invoices", terms: ["invoices", "invoice"] },
  { path: "/app/contracts", terms: ["contracts", "contract"] },
  { path: "/app/materials", terms: ["materials", "material list"] },
  { path: "/app/calendar", terms: ["calendar", "schedule"] },
  { path: "/app/settings", terms: ["settings", "preferences"] },
  { path: "/app/branding", terms: ["branding", "brand"] },
  { path: "/app/billing", terms: ["billing", "subscription"] },
  { path: "/app/vendors", terms: ["vendors", "vendor"] },
  { path: "/app/leads", terms: ["leads", "lead"] },
  { path: "/app/jobs", terms: ["jobs", "job"] },
  { path: "/app/crew", terms: ["crew", "team"] },
  { path: "/app", terms: ["dashboard", "home"] },
];

export function resolveTakeoverIntent(command: string) {
  const normalized = command.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!/^(please )?((can|could|would) you )?(open|go to|show|take me to|navigate to|switch to|bring up|view)\b/.test(normalized)) return null;

  const match = TAKEOVER_ROUTE_TERMS.find(({ terms }) =>
    terms.some((term) => new RegExp(`\\b${term.replace(/ /g, "\\s+")}\\b`).test(normalized)),
  );
  return match ? resolveTakeoverRoute(match.path) : null;
}

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
}

export function collectFastTractScreenContext(
  doc: Document = document,
  path = window.location.pathname,
): FastTractScreenContext {
  const page = doc.querySelector<HTMLElement>("[data-fasttract-page]") ?? doc.querySelector<HTMLElement>("main");
  const visibleControls: string[] = [];
  const seen = new Set<string>();

  page?.querySelectorAll<HTMLElement>("h1, h2, h3, button, a, label, th, [role='tab'], [aria-label]").forEach((element) => {
    if (element.closest("#floating-assistant-root") || element.getAttribute("aria-hidden") === "true") return;
    const label = cleanText(element.getAttribute("aria-label") || element.innerText || element.textContent);
    if (!label || seen.has(label) || /password|secret|api key/i.test(label)) return;
    seen.add(label);
    visibleControls.push(label);
  });

  return {
    path,
    title: cleanText(doc.title),
    visibleControls: visibleControls.slice(0, 60),
  };
}
