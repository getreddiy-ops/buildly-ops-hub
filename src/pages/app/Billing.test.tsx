import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Billing from "./Billing";

type MockSubscription = {
  status: string;
  current_period_end: string | null;
  cancel_at_period_end?: boolean;
};

const {
  openCheckout,
  refetch,
  invoke,
  trackTrialStart,
  toastSuccess,
  subscriptionState,
} = vi.hoisted(() => ({
  openCheckout: vi.fn(),
  refetch: vi.fn(),
  invoke: vi.fn(),
  trackTrialStart: vi.fn(),
  toastSuccess: vi.fn(),
  subscriptionState: {
    subscription: null as MockSubscription | null,
    isActive: false,
    isPastDue: false,
    isOwner: true,
    tier: null as "base" | "plus" | "premium" | null,
    loading: false,
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "owner@example.com" },
    activeOrg: { organization_id: "org-1", role: "owner" },
  }),
}));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ ...subscriptionState, refetch }),
}));
vi.mock("@/hooks/usePaddleCheckout", () => ({
  usePaddleCheckout: () => ({ openCheckout, loading: false }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));
vi.mock("@/lib/paddle", () => ({ getPaddleEnvironment: () => "live" }));
vi.mock("@/lib/gtag", () => ({ trackTrialStart }));
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: vi.fn() },
}));
vi.mock("@/components/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

describe("Billing checkout activation", () => {
  beforeEach(() => {
    subscriptionState.subscription = null;
    subscriptionState.isActive = false;
    subscriptionState.isPastDue = false;
    subscriptionState.isOwner = true;
    subscriptionState.tier = null;
    subscriptionState.loading = false;
    openCheckout.mockReset();
    refetch.mockReset();
    invoke.mockReset();
    trackTrialStart.mockReset();
    toastSuccess.mockReset();
  });

  it("waits for verified entitlement before claiming checkout activated", async () => {
    const view = render(
      <MemoryRouter initialEntries={["/app/billing?checkout=success"]}>
        <Billing />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("status")).toHaveTextContent(/activating your subscription/i);
    expect(toastSuccess).not.toHaveBeenCalled();

    subscriptionState.subscription = {
      status: "trialing",
      current_period_end: "2026-08-20T12:00:00Z",
    };
    subscriptionState.isActive = true;
    subscriptionState.tier = "base";
    view.rerender(
      <MemoryRouter initialEntries={["/app/billing"]}>
        <Billing />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Subscription activated — your plan is ready.",
      );
    });
    expect(trackTrialStart).toHaveBeenCalledTimes(1);
  });

  it("sends an existing subscriber to management instead of opening a second checkout", async () => {
    subscriptionState.subscription = {
      status: "active",
      current_period_end: "2026-08-20T12:00:00Z",
    };
    subscriptionState.isActive = true;
    subscriptionState.tier = "base";
    invoke.mockResolvedValue({ data: { url: "https://customer-portal.paddle.com/session" }, error: null });
    const openWindow = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <MemoryRouter initialEntries={["/app/billing"]}>
        <Billing />
      </MemoryRouter>,
    );
    const upgradeButtons = screen.getAllByRole("button", { name: /manage upgrade/i });
    expect(upgradeButtons).toHaveLength(2);
    fireEvent.click(upgradeButtons[0]);

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(openCheckout).not.toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledWith(
      "https://customer-portal.paddle.com/session",
      "_blank",
      "noopener,noreferrer",
    );
    openWindow.mockRestore();
  });
});
