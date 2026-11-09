import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SubscriptionGate } from "./SubscriptionGate";

const { state } = vi.hoisted(() => ({ state: { admin: false, active: false, loading: false } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isPlatformAdmin: state.admin }) }));
vi.mock("@/hooks/useSubscription", () => ({ useSubscription: () => ({ isActive: state.active, loading: state.loading }) }));

function at(path: string) {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/app/billing" element={<SubscriptionGate><p>billing page</p></SubscriptionGate>} />
    <Route path="/app/jobs" element={<SubscriptionGate><p>jobs page</p></SubscriptionGate>} />
  </Routes></MemoryRouter>);
}

describe("SubscriptionGate", () => {
  beforeEach(() => Object.assign(state, { admin: false, active: false, loading: false }));
  it("sends a business without a plan to Plan & billing", () => { at("/app/jobs"); expect(screen.getByText("billing page")).toBeInTheDocument(); });
  it("lets an active plan through", () => { state.active = true; at("/app/jobs"); expect(screen.getByText("jobs page")).toBeInTheDocument(); });
  it("lets platform admins through without a plan", () => { state.admin = true; at("/app/jobs"); expect(screen.getByText("jobs page")).toBeInTheDocument(); });
  it("never blocks the billing page itself", () => { at("/app/billing"); expect(screen.getByText("billing page")).toBeInTheDocument(); });
});
