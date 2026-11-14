import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GettingStarted from "./GettingStarted";

const counts: Record<string, number> = { customers: 2 };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: (_cols: string, opts?: { head?: boolean }) => ({
        eq: () => opts?.head
          ? Promise.resolve({ count: counts[table] ?? 0, error: null })
          : { maybeSingle: async () => ({ data: { name: "Acme Concrete", phone: "555", address: "1 Main", logo_url: null, stripe_charges_enabled: false }, error: null }) },
      }),
    }),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ activeOrg: { organization_id: "o1", role: "owner" } }),
}));

const renderPage = () => render(<MemoryRouter><GettingStarted /></MemoryRouter>);

describe("GettingStarted", () => {
  beforeEach(() => localStorage.clear());

  it("shows progress detected from the business's data", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("2 of 9 setup steps done")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Next: Add your logo/ })).toHaveAttribute("href", "/app/branding");
    expect(screen.getByRole("link", { name: /Open materials/ })).toHaveAttribute("href", "/app/materials");
  });

  it("lets the owner check off a step by hand and remembers it", async () => {
    renderPage();
    await screen.findByText("2 of 9 setup steps done");
    fireEvent.click(screen.getByRole("button", { name: 'Mark "Add your logo and document style" done' }));
    expect(screen.getByText("3 of 9 setup steps done")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("fasttract.setup.manual.o1")!)).toEqual(["branding"]);
  });

  it("does not let a data-detected step be unchecked", async () => {
    renderPage();
    await screen.findByText("2 of 9 setup steps done");
    expect(screen.getByRole("button", { name: 'Mark "Fill in your business profile" not done' })).toBeDisabled();
  });
});
