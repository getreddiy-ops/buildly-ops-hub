import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Preferences from "./Preferences";

const authState = vi.hoisted(() => ({ isPlatformAdmin: false }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { full_name: "Jane", phone: "555", business_profile: {} } }),
        }),
      }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "jane@example.com" },
    activeOrg: { organization_id: "o1", organization: { id: "o1", name: "Acme Roofing", slug: null } },
    signOut: vi.fn(),
    isPlatformAdmin: authState.isPlatformAdmin,
  }),
}));
vi.mock("@/hooks/useBranding", () => ({
  useBranding: () => ({
    branding: {
      id: "o1",
      name: "Acme Roofing",
      legal_name: "Acme Roofing LLC",
      logo_url: null,
      logo_signed_url: null,
      brand_color: "#ff5500",
      brand_color_secondary: "#000000",
      address: "1 Main St",
      phone: "555-1212",
      email: "hi@acme.com",
      website: "acme.com",
      tax_id: null,
      document_defaults: { invoice: { header: "Thanks for your business", terms: "Net 30" } },
    },
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("Settings Home", () => {
  it("hides Developer settings from regular customers", async () => {
    authState.isPlatformAdmin = false;
    render(
      <MemoryRouter>
        <Preferences />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText(/Acme Roofing/i).length).toBeGreaterThan(0));
    expect(screen.queryByText(/^Developer$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open developer/i })).not.toBeInTheDocument();
  });

  it("keeps Developer settings available to platform administrators", async () => {
    authState.isPlatformAdmin = true;
    render(
      <MemoryRouter>
        <Preferences />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/^Developer$/i)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Open developer/i })).toHaveAttribute("href", "/app/developer");
  });

  it("renders org-personalized header and section cards with correct links", async () => {
    authState.isPlatformAdmin = false;
    render(
      <MemoryRouter>
        <Preferences />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText(/Acme Roofing/i).length).toBeGreaterThan(0));
    expect(screen.getByRole("heading", { name: /Invoice & document appearance/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Team & crew/i })).toBeInTheDocument();
    expect(screen.getByText(/Billing & plan/i)).toBeInTheDocument();

    const customize = screen.getAllByRole("link", { name: /Customize invoices/i })[0];
    expect(customize).toHaveAttribute("href", "/app/branding");

    const billing = screen.getByRole("link", { name: /Go to billing/i });
    expect(billing).toHaveAttribute("href", "/app/billing");

    const crew = screen.getByRole("link", { name: /Manage team/i });
    expect(crew).toHaveAttribute("href", "/app/crew");

    // Invoice defaults surfaced
    expect(screen.getByText(/Net 30/)).toBeInTheDocument();
  });
});
