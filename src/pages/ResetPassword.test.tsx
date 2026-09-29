import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPassword from "./ResetPassword";

const { updateUser, toast, authState } = vi.hoisted(() => ({
  updateUser: vi.fn(),
  toast: vi.fn(),
  authState: { user: { email: "owner@example.com" } as { email: string } | null, loading: false },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { updateUser: (...args: unknown[]) => updateUser(...args) } },
}));
vi.mock("@/hooks/use-toast", () => ({ toast }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/Logo", () => ({ Logo: () => null }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    ...authState,
    memberships: [{ role: "owner" }],
    isPlatformAdmin: false,
    isAgent: false,
  }),
}));

function renderReset() {
  return render(
    <MemoryRouter initialEntries={["/reset-password"]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/app" element={<p>Password reset finished.</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ResetPassword", () => {
  beforeEach(() => {
    updateUser.mockReset();
    authState.user = { email: "owner@example.com" };
    authState.loading = false;
  });

  it("updates the password and returns the signed-in owner to the app", async () => {
    updateUser.mockResolvedValue({ error: null });
    renderReset();
    fireEvent.change(screen.getByLabelText("New password", { exact: true }), { target: { value: "contractor-strong-123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password", { exact: true }), { target: { value: "contractor-strong-123" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "contractor-strong-123" }));
    expect(await screen.findByText("Password reset finished.")).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Password updated" }));
  });

  it("does not update when the confirmation differs", async () => {
    renderReset();
    fireEvent.change(screen.getByLabelText("New password", { exact: true }), { target: { value: "contractor-strong-123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password", { exact: true }), { target: { value: "something-else-123" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/passwords do not match/i);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("explains when the reset link has no recovery session", () => {
    authState.user = null;
    renderReset();
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return to sign in/i })).toHaveAttribute("href", "/login");
  });
});
