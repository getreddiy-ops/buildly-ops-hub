import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Billing from "./GhlBilling";
const { native } = vi.hoisted(() => ({ native: vi.fn() }));
vi.mock("@/lib/native", () => ({ isNativeApp: native }));
vi.mock("@/hooks/useSubscription", () => ({ useSubscription: () => ({ isActive: true, loading: false, refetch: vi.fn() }) }));
describe("native subscription screen", () => {
  it("shows existing access without a purchase link", () => {
    native.mockReturnValue(true);
    render(<MemoryRouter><Billing /></MemoryRouter>);
    expect(screen.getByText(/active app access record/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open secure checkout" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Compare plans" })).not.toBeInTheDocument();
  });
  it("preserves the web checkout", () => {
    native.mockReturnValue(false);
    render(<MemoryRouter><Billing /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Open secure checkout" })).toBeInTheDocument();
  });
});
