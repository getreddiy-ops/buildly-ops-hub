import type { DocumentDefaults } from "@/hooks/useBranding";

type BusinessProfile = Record<string, unknown> | null | undefined;

export type BusinessOnboardingData = {
  name?: string | null;
  legal_name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  tax_id?: string | null;
  logo_url?: string | null;
  logo_signed_url?: string | null;
  brand_color?: string | null;
  brand_color_secondary?: string | null;
  document_defaults?: DocumentDefaults | null;
  business_profile?: BusinessProfile;
};

export type BusinessOnboardingItem = {
  key: string;
  label: string;
  done: boolean;
  to: string;
};

const AI_PROFILE_ESSENTIALS = [
  "industry",
  "services",
  "service_area",
  "business_hours",
  "pricing_model",
  "payment_terms",
  "brand_voice",
  "lead_qualification",
  "booking_policy",
  "escalation_contact",
] as const;

function isFilled(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
}
function hasDocumentTemplate(defaults: DocumentDefaults | null | undefined, type: keyof DocumentDefaults) {
  const template = defaults?.[type];
  return !!template && [template.header, template.notes, template.terms, template.footer].some(isFilled);
}

function hasAiProfileEssentials(profile: BusinessProfile) {
  if (!profile) return false;
  return AI_PROFILE_ESSENTIALS.every((field) => isFilled(profile[field]));
}

export function getBusinessOnboardingProgress(data: BusinessOnboardingData) {
  const items: BusinessOnboardingItem[] = [
    {
      key: "identity",
      label: "Display and legal business names",
      done: isFilled(data.name) && isFilled(data.legal_name),
      to: "/app/branding",
    },
    {
      key: "contact",
      label: "Business address, phone, and email",
      done: isFilled(data.address) && isFilled(data.phone) && isFilled(data.email),
      to: "/app/branding",
    },
    {
      key: "website",
      label: "Business website",
      done: isFilled(data.website),
      to: "/app/branding",
    },
    {
      key: "tax_id",
      label: "Tax ID or contractor license",
      done: isFilled(data.tax_id),
      to: "/app/branding",
    },
    {
      key: "brand",
      label: "Logo and brand colors",
      done:
        isFilled(data.logo_url ?? data.logo_signed_url) &&
        isFilled(data.brand_color) &&
        isFilled(data.brand_color_secondary),
      to: "/app/branding",
    },
    {
      key: "estimate_template",
      label: "Estimate document defaults",
      done: hasDocumentTemplate(data.document_defaults, "estimate"),
      to: "/app/branding",
    },
    {
      key: "invoice_template",
      label: "Invoice document defaults",
      done: hasDocumentTemplate(data.document_defaults, "invoice"),
      to: "/app/branding",
    },
    {
      key: "contract_template",
      label: "Contract document defaults",
      done: hasDocumentTemplate(data.document_defaults, "contract"),
      to: "/app/branding",
    },
    {
      key: "ai_profile",
      label: "AI business profile essentials",
      done: hasAiProfileEssentials(data.business_profile),
      to: "/app/business-profile",
    },
  ];
  const done = items.filter((item) => item.done).length;
  const total = items.length;

  return {
    items,
    done,
    total,
    pct: Math.round((done / total) * 100),
    complete: done === total,
  };
}
