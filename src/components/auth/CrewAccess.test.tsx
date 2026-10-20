import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RequireOfficeRole, RequireOrg } from "./Guards";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({
  user: { id: "crew-user" }, loading: false, isPlatformAdmin: false,
  memberships: [{ role: "worker", organization_id: "org" }], activeOrg: { role: "worker" },
}) }));

describe("crew portal boundaries", () => {
  it("renders the worker dashboard without redirecting back to itself", () => {
    render(<MemoryRouter initialEntries={["/field"]}><Routes>
      <Route path="/field" element={<RequireOrg><p>My time clock</p></RequireOrg>} />
    </Routes></MemoryRouter>);
    expect(screen.getByText("My time clock")).toBeVisible();
  });
  it("redirects a worker away from office editing routes", () => {
    render(<MemoryRouter initialEntries={["/app/crew"]}><Routes>
      <Route path="/app/crew" element={<RequireOfficeRole><p>Edit members</p></RequireOfficeRole>} />
      <Route path="/field" element={<p>Worker dashboard</p>} />
    </Routes></MemoryRouter>);
    expect(screen.getByText("Worker dashboard")).toBeVisible();
    expect(screen.queryByText("Edit members")).not.toBeInTheDocument();
  });
});
