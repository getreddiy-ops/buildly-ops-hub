import { beforeEach, describe, expect, it, vi } from "vitest";
import { authEmailRedirect } from "./native";
const { native } = vi.hoisted(() => ({ native: vi.fn() }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: native } }));
describe("authentication email callbacks", () => {
  beforeEach(() => native.mockReset());
  it("uses public HTTPS callbacks on native", () => {
    native.mockReturnValue(true);
    expect(authEmailRedirect("/onboarding")).toBe("https://fasttract-app.vercel.app/onboarding");
    expect(authEmailRedirect("/reset-password")).toBe("https://fasttract-app.vercel.app/reset-password");
  });
  it("preserves the current web origin", () => {
    native.mockReturnValue(false);
    expect(authEmailRedirect("/onboarding")).toBe(`${window.location.origin}/onboarding`);
  });
});
