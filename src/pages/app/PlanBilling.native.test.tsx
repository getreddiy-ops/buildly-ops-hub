import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Billing from "./PlanBilling";

const { native, sub, startCheckout, openPortal } = vi.hoisted(() => ({
  native: vi.fn(),
  sub: { current: {} as Record<string, unknown> },
  startCheckout: vi.fn(async () => {}),
  openPortal: vi.fn(async () => {}),
}));
vi.mock("@/lib/native", () => ({ isNativeApp: native }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ activeOrg: { organization_id: "org-1", role: "owner" } }) }));
vi.mock("@/hooks/useSubscription", () => ({ useSubscription: () => sub.current }));
vi.mock("@/hooks/useStripeBilling", () => ({ useStripeBilling: () => ({ startCheckout, openPortal, loading: null }) }));

const none = { subscription: null, isActive: false, isOwner: true, tier: null, loading: false, refetch: vi.fn() };

describe("Plan & billing", () => {
  beforeEach(() => { vi.clearAllMocks(); native.mockReturnValue(false); sub.current = none; });

  it("offers a free trial on each plan and starts Stripe checkout with the monthly price", () => {
    render(<MemoryRouter><Billing /></MemoryRouter>);
    const buttons = screen.getAllByRole("button", { name: "Start free trial" });
    expect(buttons).toHaveLength(3);
    fireEvent.click(buttons[1]);
    expect(startCheckout).toHaveBeenCalledWith("org-1", "contractor_os_plus_monthly");
  });

  it("switches to yearly prices", () => {
    render(<MemoryRouter><Billing /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Yearly/ }));
    expect(screen.getByText("$1,970")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Start free trial" })[0]);
    expect(startCheckout).toHaveBeenCalledWith("org-1", "contractor_os_pro_yearly");
  });

  it("shows the current Stripe plan with a portal button for the owner", () => {
    sub.current = { ...none, isActive: true, tier: "plus", subscription: { status: "trialing", billing_provider: "stripe", current_period_end: "2026-11-16T00:00:00Z" } };
    render(<MemoryRouter><Billing /></MemoryRouter>);
    expect(screen.getByText("FastTract Pro")).toBeInTheDocument();
    expect(screen.getByText(/Trial ends/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change plan, card or invoices" }));
    expect(openPortal).toHaveBeenCalledWith("org-1");
  });

  it("never shows a purchase or plan link inside the native app", () => {
    native.mockReturnValue(true);
    render(<MemoryRouter><Billing /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "Start free trial" })).not.toBeInTheDocument();
    expect(screen.getByText(/managed on the web/)).toBeInTheDocument();
  });
});
