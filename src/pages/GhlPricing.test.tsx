import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { afterEach, describe, expect, it, vi } from "vitest";
import Pricing from "./GhlPricing";
import Billing from "./app/GhlBilling";
import { FASTTRACT_CHECKOUT_URL } from "@/lib/sales";

const refetch = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useSubscription", () => ({ useSubscription: () => ({ isActive: false, loading: false, refetch }) }));
afterEach(cleanup);

describe("existing FastTract sales path", () => {
  it("shows the existing GHL plans and sends purchases to the same checkout", () => {
    render(<HelmetProvider><MemoryRouter><Pricing /></MemoryRouter></HelmetProvider>);
    for (const name of ["FastTract Basic", "FastTract Pro", "FastTract Enterprise"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "Choose at secure checkout" })) expect(link).toHaveAttribute("href", FASTTRACT_CHECKOUT_URL);
    expect(screen.getByText("$197")).toBeInTheDocument();
    expect(screen.getByText("$297")).toBeInTheDocument();
    expect(screen.getByText("$397")).toBeInTheDocument();
  });
  it("lets existing buyers check app access without starting another purchase", () => {
    render(<MemoryRouter><Billing /></MemoryRouter>);
    expect(screen.getByText("Do not purchase a second subscription to unlock this app.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check app access" }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Get billing or access help" })).toHaveAttribute("href", expect.stringContaining("mailto:"));
  });
});
