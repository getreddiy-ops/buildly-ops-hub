import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequirePlatformAdmin } from "./Guards";

const authState = vi.hoisted(() => ({ isPlatformAdmin: false, loading: false }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

function TestRoutes() {
  return (
    <MemoryRouter initialEntries={["/app/developer"]}>
      <Routes>
        <Route
          path="/app/developer"
          element={(
            <RequirePlatformAdmin redirectTo="/app/settings">
              <div>Developer tools</div>
            </RequirePlatformAdmin>
          )}
        />
        <Route path="/app/settings" element={<div>Settings Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequirePlatformAdmin", () => {
  it("redirects regular customers away from Developer settings", () => {
    authState.isPlatformAdmin = false;
    render(<TestRoutes />);
    expect(screen.getByText("Settings Home")).toBeInTheDocument();
    expect(screen.queryByText("Developer tools")).not.toBeInTheDocument();
  });

  it("allows platform administrators to access Developer settings", () => {
    authState.isPlatformAdmin = true;
    render(<TestRoutes />);
    expect(screen.getByText("Developer tools")).toBeInTheDocument();
  });
});
