import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";

const { resetPasswordForEmail, toast } = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmail(...args) } },
}));
vi.mock("@/hooks/use-toast", () => ({ toast }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/Logo", () => ({ Logo: () => null }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false, memberships: [], isPlatformAdmin: false, isAgent: false }),
}));

function renderLogin() {
  return render(<MemoryRouter initialEntries={["/login"]}><Login /></MemoryRouter>);
}

describe("Login password recovery", () => {
  beforeEach(() => resetPasswordForEmail.mockReset());

  it("sends the entered email to the same-origin reset route without revealing account existence", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: " owner@example.com " } });
    fireEvent.click(screen.getByRole("button", { name: /forgot password/i }));

    await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "owner@example.com",
      { redirectTo: `${window.location.origin}/reset-password` },
    ));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Check your email",
      description: expect.stringContaining("If an account exists"),
    }));
  });

  it("does not call Supabase until an email has been entered", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: /forgot password/i })).toBeDisabled();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
