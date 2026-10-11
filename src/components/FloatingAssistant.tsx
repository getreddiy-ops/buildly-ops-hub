import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bot, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import Assistant from "@/pages/app/Assistant";
import { PaywallGate } from "@/components/PaywallGate";

// Route shortcuts the assistant can navigate to via "go to X" / "open X"
const ROUTES: { keywords: string[]; path: string; label: string }[] = [
  { keywords: ["dashboard", "home"], path: "/app", label: "Dashboard" },
  { keywords: ["leads", "lead"], path: "/app/leads", label: "Leads" },
  { keywords: ["customers", "customer", "clients", "client"], path: "/app/customers", label: "Customers" },
  { keywords: ["estimates", "estimate", "quote", "quotes"], path: "/app/estimates", label: "Estimates" },
  { keywords: ["invoices", "invoice", "billing invoices"], path: "/app/invoices", label: "Invoices" },
  { keywords: ["contracts", "contract"], path: "/app/contracts", label: "Contracts" },
  { keywords: ["jobs", "job", "schedule"], path: "/app/jobs", label: "Jobs" },
  { keywords: ["crew", "team", "workers"], path: "/app/crew", label: "Crew" },
  { keywords: ["vendors", "vendor", "suppliers", "supplier"], path: "/app/vendors", label: "Vendors" },
  { keywords: ["materials", "material", "inventory"], path: "/app/materials", label: "Materials" },
  { keywords: ["time", "time tracking", "timesheets", "hours"], path: "/app/time", label: "Time Tracking" },
  { keywords: ["approvals", "approve"], path: "/app/approvals", label: "Approvals" },
  { keywords: ["costing", "job costing", "margin", "profit"], path: "/app/costing", label: "Job Costing" },
  { keywords: ["assistant", "ai assistant", "ai"], path: "/app/assistant", label: "AI Assistant" },
  { keywords: ["phone", "phone assistant", "phone agent", "call"], path: "/app/phone-assistant", label: "Phone Assistant" },
  { keywords: ["billing", "subscription", "plan"], path: "/app/billing", label: "Billing" },
  { keywords: ["business profile", "profile"], path: "/app/business-profile", label: "Business Profile" },
  { keywords: ["branding", "logo", "colors"], path: "/app/branding", label: "Branding" },
  { keywords: ["settings"], path: "/app/settings", label: "Settings" },
  { keywords: ["field", "mobile", "clock in"], path: "/field", label: "Field App" },
];

// Try to parse a "navigate" intent from a user prompt before sending to AI.
export function tryParseNavigation(input: string): { path: string; label: string } | null {
  const t = input.toLowerCase().trim();
  const m = t.match(/^(?:go to|open|navigate to|take me to|show me|show|view)\s+(?:the\s+|my\s+)?(.+?)[.?!]*$/);
  // Business requests must reach Ask AI; only complete targets navigate.
  const target = (m ? m[1] : t).trim();
  for (const route of ROUTES) {
    if (route.keywords.includes(target)) return { path: route.path, label: route.label };
  }
  return null;
}

export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Close on route change so the drawer doesn't trap focus across navigations
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Listen for global "open assistant" events
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-assistant", handler);
    return () => window.removeEventListener("open-assistant", handler);
  }, []);

  const navigateFromPrompt = (text: string) => {
    const target = tryParseNavigation(text);
    if (!target) return false;
    navigate(target.path);
    setOpen(false);
    return true;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Ask AI"
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-40 grid h-14 w-14 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-elevated transition hover:scale-105 active:scale-95"
      >
        <Bot className="h-6 w-6" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-[480px]">
          <div id="floating-assistant-root" className="flex h-full flex-col">
            <SheetHeader className="flex flex-row items-center justify-between border-b border-border px-4 py-3 space-y-0">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4 text-primary" /> Ask AI
              </SheetTitle>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </SheetHeader>
            <div className="flex-1 overflow-hidden px-4 py-3">
              <PaywallGate feature="AI Assistant">
                <Assistant compact onNavigate={navigateFromPrompt} />
              </PaywallGate>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
