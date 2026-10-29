import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InvoiceLineEditor, blankInvoiceLine, type InvoiceLine } from "./InvoiceLineEditor";
afterEach(cleanup);

describe("Invoice line editor", () => {
  it("adds a saved categorized item, permits invoice-specific edits and saves the edited item explicitly", () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saved = { ...blankInvoiceLine(), id: "saved-1", description: "Concrete pump", category: "Equipment", unit: "hr", quantity: 2, unit_price: 250 };
    function Editor() {
      const [items, setItems] = useState<InvoiceLine[]>([blankInvoiceLine()]);
      return <InvoiceLineEditor items={items} onChange={setItems} catalog={[saved]} onSaveItem={save} savingItem={false} />;
    }
    render(<Editor />);
    fireEvent.click(screen.getByText("Saved item library (1)"));
    fireEvent.change(screen.getByLabelText("Search by item or category"), { target: { value: "equipment" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Concrete pump" }));
    expect(screen.getByLabelText("Description")).toHaveValue("Concrete pump");
    expect(screen.getByLabelText("Category")).toHaveValue("Equipment");
    expect(screen.getByLabelText("Unit")).toHaveValue("hr");
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "3" } });
    expect(screen.getByText("Line total: $750.00")).toBeVisible();
    expect(saved.quantity).toBe(2);
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save to library" }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ category: "Equipment", quantity: 3, unit_price: 250 }));
    fireEvent.click(screen.getByRole("button", { name: "Add line item" }));
    expect(screen.getAllByLabelText("Description")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(screen.getByLabelText("Description")).toHaveValue("");
  });
});
