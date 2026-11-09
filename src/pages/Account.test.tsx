import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Account from "./Account";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
describe("account deletion requests", () => {
  beforeEach(() => rpc.mockReset());
  it("requires consent and reports success after server persistence", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ error: null });
    render(<MemoryRouter><Account /></MemoryRouter>);
    const button = await screen.findByRole("button", { name: "Request permanent account deletion" });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(button);
    await screen.findByText(/Your deletion request is recorded/);
    expect(rpc).toHaveBeenLastCalledWith("request_account_deletion");
  });
  it("does not show success after a rejected request", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ error: { message: "offline" } });
    render(<MemoryRouter><Account /></MemoryRouter>);
    await screen.findByRole("button", { name: "Request permanent account deletion" });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Request permanent account deletion" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Your deletion request is recorded/)).not.toBeInTheDocument();
  });
  it("blocks submission when status cannot be checked", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "missing migration" } });
    render(<MemoryRouter><Account /></MemoryRouter>);
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Request permanent account deletion" })).not.toBeInTheDocument();
  });
});
