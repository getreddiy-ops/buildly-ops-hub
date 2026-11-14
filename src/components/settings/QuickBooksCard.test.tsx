import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QuickBooksCard } from "./QuickBooksCard";

const { state, invoke } = vi.hoisted(() => ({ state: { role: "owner" }, invoke: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ activeOrg: { organization_id: "org-bfc", role: state.role } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("QuickBooks settings", () => {
  beforeEach(() => { vi.clearAllMocks(); state.role = "owner"; });

  it("shows the connected company and syncs on demand", async () => {
    invoke.mockImplementation(async (_fn: string, { body }: { body: { action?: string } }) =>
      body.action === "status" ? { data: { connected: true, healthy: true, companyName: "Branden Fletcher Concrete, LLC", recent: [] }, error: null }
        : { data: { synced: 3, failed: 0, more: false }, error: null });
    render(<MemoryRouter><QuickBooksCard /></MemoryRouter>);
    expect(await screen.findByText("Branden Fletcher Concrete, LLC")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("quickbooks", { body: { organizationId: "org-bfc" } }));
  });

  it("offers Connect when nothing is connected", async () => {
    invoke.mockResolvedValue({ data: { connected: false, healthy: false, recent: [] }, error: null });
    render(<MemoryRouter><QuickBooksCard /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: "Connect QuickBooks" })).toBeInTheDocument();
  });

  it("is hidden from crew", () => {
    state.role = "worker";
    const { container } = render(<MemoryRouter><QuickBooksCard /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
