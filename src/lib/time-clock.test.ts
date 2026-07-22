import { describe, expect, it } from "vitest";
import {
  canChooseAnyOrgJob,
  distanceInMeters,
  elapsedTime,
} from "@/lib/time-clock";

describe("time clock helpers", () => {
  it("lets owners and admins choose any active organization job", () => {
    expect(canChooseAnyOrgJob("owner")).toBe(true);
    expect(canChooseAnyOrgJob("admin")).toBe(true);
    expect(canChooseAnyOrgJob("worker")).toBe(false);
  });

  it("calculates nearby job distance in meters", () => {
    const meters = distanceInMeters(
      { lat: 45.5152, lng: -122.6784 },
      { lat: 45.5161, lng: -122.6784 },
    );

    expect(meters).toBeGreaterThan(95);
    expect(meters).toBeLessThan(105);
  });

  it("formats an active shift duration", () => {
    expect(elapsedTime("2026-07-21T10:00:00.000Z", Date.parse("2026-07-21T11:02:03.000Z"))).toBe(
      "01:02:03",
    );
  });
});
