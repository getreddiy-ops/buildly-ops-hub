import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuickCreateCustomerButton } from "./QuickCreateCustomerButton";

const { createCustomer } = vi.hoisted(() => ({ createCustomer: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ activeOrg: { organization_id: "org-test" } }) }));
vi.mock("@/lib/fasttractApi", () => ({ FastTractApi: { createCustomer } }));

describe("quick customer wizard", () => {
  it("collects name parts on separate screens and preserves their natural order in the existing API", async () => {
    createCustomer.mockResolvedValue({ data: { id: "customer-test", name: "Alex Jordan Rivera" } });
    const onCreated = vi.fn();
    render(<QuickCreateCustomerButton onCreated={onCreated} />);
    fireEvent.click(screen.getByRole("button", { name: "New customer" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Last name (optional)" })).toBeVisible();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Rivera" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Middle name (optional)" })).toBeVisible();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Jordan" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Street address" })).toBeVisible();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "123 Main St" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Portland" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "OR" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "97201" } });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(createCustomer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Create customer" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createCustomer).toHaveBeenCalledWith("org-test", {
      name: "Alex Jordan Rivera", email: null, phone: null, address: "123 Main St\nPortland, OR 97201",
    });
  }, 15000);
});
