import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Settings from "./Settings";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === "profiles"
              ? { full_name: "Jane", phone: "555" }
              : {
                  stripe_connected_account_id: null,
                  stripe_connect_status: "not_connected",
                  stripe_charges_enabled: false,
                  stripe_payouts_enabled: false,
                  stripe_details_submitted: false,
                },
            error: null,
          }),
        }),
      }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
    functions: {
      invoke: async () => ({ data: { connected: false }, error: null }),
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "jane@example.com" },
    activeOrg: { organization_id: "o1", organization: { id: "o1", name: "Acme Roofing", slug: null } },
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/useBranding", () => ({
  useBranding: () => ({ branding: { id: "o1", name: "Acme Roofing" } }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("FastTract Settings", () => {
  it("renders FastTract-native business settings", async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText(/Acme Roofing/i).length).toBeGreaterThan(0));
    expect(screen.getByText(/FastTract native/i)).toBeInTheDocument();
    expect(screen.getByText(/Customer payments/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect Stripe/i })).toBeInTheDocument();
  });

  it("links to the native FastTract business tools", async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/Business profile/i)).toBeInTheDocument());
    const links = screen.getAllByRole("link", { name: "Open" });
    const hrefs = links.map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/app/business-profile");
    expect(hrefs).toContain("/app/branding");
    expect(hrefs).toContain("/app/crew");
    expect(hrefs).toContain("/app/phone-assistant");
    expect(hrefs).toContain("/app/messages");
    expect(hrefs).toContain("/app/billing");
  });

  it("does not expose a GHL or HighLevel settings card", async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/FastTract native/i)).toBeInTheDocument());
    expect(screen.queryByText(/GoHighLevel/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/HighLevel/i)).not.toBeInTheDocument();
  });
});
