import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { NativeBoundary } from "./NativeBoundary";
const { native } = vi.hoisted(() => ({ native: vi.fn() }));
vi.mock("@/lib/native", () => ({ isNativeApp: native }));
function open(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><NativeBoundary><Routes>
    <Route path="/login" element={<p>Sign in</p>} />
    <Route path="/pricing" element={<p>Purchase plans</p>} />
    <Route path="/account" element={<p>Delete account</p>} />
  </Routes></NativeBoundary></MemoryRouter>);
}
describe("native companion navigation", () => {
  it("blocks native navigation to sales", async () => {
    native.mockReturnValue(true); open("/pricing");
    expect(await screen.findByText("Sign in")).toBeInTheDocument();
    expect(screen.queryByText("Purchase plans")).not.toBeInTheDocument();
  });
  it("preserves web sales", () => {
    native.mockReturnValue(false); open("/pricing");
    expect(screen.getByText("Purchase plans")).toBeInTheDocument();
  });
  it("keeps native account deletion reachable", () => {
    native.mockReturnValue(true); open("/account");
    expect(screen.getByText("Delete account")).toBeInTheDocument();
  });
});
