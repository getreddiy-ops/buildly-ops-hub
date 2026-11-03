import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { afterEach, describe, expect, it, vi } from "vitest";
import Pricing from "./SalesPricing";
import Billing from "./app/PlanBilling";
import { FASTTRACT_SALES_MAILTO } from "@/lib/sales";

const refetch = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useSubscription", () => ({ useSubscription: () => ({ isActive: false, loading: false, refetch }) }));
afterEach(cleanup);

describe("FastTract sales path while checkout is paused", () => {
  it("shows the plans and sends signups to contact instead of a checkout", () => {
    render(<HelmetProvider><MemoryRouter><Pricing /></MemoryRouter></HelmetProvider>);
    for (const name of ["FastTract Basic", "FastTract Pro", "FastTract Enterprise"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "Contact us to get started" })) expect(link).toHaveAttribute("href", FASTTRACT_SALES_MAILTO);
    expect(screen.getByText("$197")).toBeInTheDocument();
    expect(screen.getByText("$297")).toBeInTheDocument();
    expect(screen.getByText("$397")).toBeInTheDocument();
    expect(document.body.innerHTML).not.toMatch(/payment-link|highlevel/i);
  });
  it("lets existing customers check access and reach billing help", () => {
    render(<MemoryRouter><Billing /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Check app access" }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Get billing or access help" })).toHaveAttribute("href", expect.stringContaining("mailto:"));
  });
});
