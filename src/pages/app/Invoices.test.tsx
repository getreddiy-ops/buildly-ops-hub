import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import Invoices from "./Invoices";
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ activeOrg: { organization_id: "org-1" }, user: { id: "user-1" } }) }));
vi.mock("@/hooks/useBranding", () => ({ useBranding: () => ({ branding: { name: "BFC", brand_color: "#33EB06", document_defaults: {} } }) }));
vi.mock("@/components/QuickCreateCustomerButton", () => ({ QuickCreateCustomerButton: () => null }));
vi.mock("@/components/SendDocumentDialog", () => ({ SendDocumentDialog: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => {
  const result = { data: [], error: null };
  const query = { select: () => query, eq: () => query, order: () => query, then: (resolve: (r: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
  return query;
} } }));
afterEach(cleanup);
describe("Invoice editing", () => {
  it("shows the live document during entry and updates its categorized rows, totals, number and notes", async () => {
    render(<Invoices />);
    await screen.findByText("No invoices yet");
    fireEvent.click(screen.getAllByRole("button", { name: "New invoice" })[0]);
    const preview = screen.getByRole("region", { name: "Live invoice preview" });
    expect(preview).toBeVisible();
    fireEvent.change(screen.getByLabelText("Invoice number"), { target: { value: "INV-BINGHAM" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Foundation forming" } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Unit price (USD)"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "hr" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Bingham progress billing" } });
    expect(within(preview).getByText("#INV-BINGHAM")).toBeVisible();
    expect(within(preview).getByText("Foundation forming")).toBeVisible();
    expect(within(preview).getByText("Labor")).toBeVisible();
    expect(within(preview).getByText("4 hr")).toBeVisible();
    expect(within(preview).getAllByText("$400.00").length).toBeGreaterThan(0);
    expect(within(preview).getByText("Bingham progress billing")).toBeVisible();
    expect(screen.queryByText(/Step 1 of/)).not.toBeInTheDocument();
    // An unfinished extra row cannot change the document total.
    fireEvent.click(screen.getByRole("button", { name: "Add line item" }));
    fireEvent.change(screen.getAllByLabelText("Unit price (USD)")[1], { target: { value: "999" } });
    expect(within(preview).queryByText("$1,399.00")).not.toBeInTheDocument();
    expect(within(preview).getAllByText("$400.00").length).toBeGreaterThan(0);
  }, 20000);
});
