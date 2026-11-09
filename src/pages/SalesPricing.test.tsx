import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { afterEach, describe, expect, it } from "vitest";
import Pricing from "./SalesPricing";

afterEach(cleanup);

describe("FastTract pricing page", () => {
  it("shows the three plans at launch prices and sends each to signup with its plan", () => {
    render(<HelmetProvider><MemoryRouter><Pricing /></MemoryRouter></HelmetProvider>);
    for (const name of ["FastTract Basic", "FastTract Pro", "FastTract Enterprise"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    expect(screen.getByText("$197")).toBeInTheDocument();
    expect(screen.getByText("$297")).toBeInTheDocument();
    expect(screen.getByText("$397")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Start 7-day free trial" });
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/signup?plan=base", "/signup?plan=plus", "/signup?plan=premium"]);
    expect(document.body.innerHTML).not.toMatch(/payment-link|highlevel|paddle/i);
  });
});
