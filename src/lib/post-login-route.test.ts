import { describe, expect, it } from "vitest";
import { resolvePostLoginRoute, safeNextPath } from "./post-login-route";

describe("resolvePostLoginRoute", () => {
  it("sends platform administrators to the admin console", () => {
    expect(resolvePostLoginRoute({
      memberships: [{ role: "owner" }],
      isPlatformAdmin: true,
      isAgent: false,
    })).toBe("/admin");
  });

  it.each(["owner", "admin"])("sends %s users to the office app", (role) => {
    expect(resolvePostLoginRoute({
      memberships: [{ role }],
      isPlatformAdmin: false,
      isAgent: false,
    })).toBe("/app");
  });

  it("sends worker-only users to the field app", () => {
    expect(resolvePostLoginRoute({
      memberships: [{ role: "worker" }],
      isPlatformAdmin: false,
      isAgent: false,
    })).toBe("/field");
  });

  it("sends agents without an organization to the agent portal", () => {
    expect(resolvePostLoginRoute({
      memberships: [],
      isPlatformAdmin: false,
      isAgent: true,
    })).toBe("/agent");
  });

  it("sends users without a role to onboarding", () => {
    expect(resolvePostLoginRoute({
      memberships: [],
      isPlatformAdmin: false,
      isAgent: false,
    })).toBe("/onboarding");
  });
});

describe("safeNextPath", () => {
  it("accepts an internal FastTract path", () => {
    expect(safeNextPath("/app/estimates")).toBe("/app/estimates");
  });

  it.each([null, "https://example.com", "//example.com"])(
    "rejects unsafe next destination %s",
    (destination) => expect(safeNextPath(destination)).toBeNull(),
  );
});
