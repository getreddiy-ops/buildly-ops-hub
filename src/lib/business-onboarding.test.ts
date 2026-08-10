import { describe, expect, it } from "vitest";
import { getBusinessOnboardingProgress } from "./business-onboarding";

const completeProfile = {
  industry: "Roofing",
  services: "Repairs and replacement",
  service_area: "Dallas County",
  business_hours: "Monday-Friday, 8-5",
  pricing_model: "Fixed bid",
  payment_terms: "30% deposit",
  brand_voice: "Friendly and direct",
  lead_qualification: "Ask address, job type, and timeline",
  booking_policy: "Two-hour arrival windows",
  escalation_contact: "Owner at 555-1212",
};

const completeBusiness = {
  name: "Acme Roofing",
  legal_name: "Acme Roofing LLC",
  address: "1 Main Street",
  phone: "555-1212",
  email: "hello@acme.example",
  website: "https://acme.example",
  tax_id: "TX-12345",
  logo_url: "org/logo.png",
  brand_color: "#ff5500",
  brand_color_secondary: "#111111",
  document_defaults: {
    estimate: { terms: "Estimate valid for 30 days" },
    invoice: { terms: "Net 30" },
    contract: { terms: "Standard workmanship terms" },
  },
  business_profile: completeProfile,
};

describe("business onboarding progress", () => {
  it("keeps every Settings detail in one onboarding checklist", () => {
    const progress = getBusinessOnboardingProgress({});

    expect(progress.items.map((item) => item.key)).toEqual([
      "identity",
      "contact",
      "website",
      "tax_id",
      "brand",
      "estimate_template",
      "invoice_template",
      "contract_template",
      "ai_profile",
    ]);
    expect(progress.done).toBe(0);
    expect(progress.complete).toBe(false);
  });

  it("only completes onboarding when all business setup groups are ready", () => {
    const progress = getBusinessOnboardingProgress(completeBusiness);

    expect(progress.done).toBe(progress.total);
    expect(progress.pct).toBe(100);
    expect(progress.complete).toBe(true);
  });

  it("reports the exact missing business setup group", () => {
    const progress = getBusinessOnboardingProgress({ ...completeBusiness, email: "" });

    expect(progress.complete).toBe(false);
    expect(progress.items.find((item) => item.key === "contact")?.done).toBe(false);
    expect(progress.done).toBe(progress.total - 1);
  });
});
