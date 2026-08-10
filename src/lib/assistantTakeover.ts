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
