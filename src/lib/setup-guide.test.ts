import { beforeEach, describe, expect, it } from "vitest";
import { computeProgress, isCardDismissed, loadManual, saveManual, setCardDismissed, SETUP_STEPS, type SetupFacts } from "./setup-guide";

const empty: SetupFacts = {
  hasProfile: false, hasLogo: false, materials: 0, customers: 0, estimates: 0,
  jobs: 0, crewInvites: 0, timeEntries: 0, invoices: 0, cardPayments: false,
};
const full: SetupFacts = {
  hasProfile: true, hasLogo: true, materials: 5, customers: 1, estimates: 1,
  jobs: 1, crewInvites: 1, timeEntries: 1, invoices: 1, cardPayments: false,
};

describe("computeProgress", () => {
  it("starts at zero and points at the business profile", () => {
    const p = computeProgress(empty, new Set());
    expect(p.doneRequired).toBe(0);
    expect(p.totalRequired).toBe(SETUP_STEPS.filter((s) => !s.optional).length);
    expect(p.next?.id).toBe("profile");
    expect(p.allRequiredDone).toBe(false);
  });

  it("treats no data yet (null facts) as nothing done", () => {
    expect(computeProgress(null, new Set()).doneRequired).toBe(0);
  });

  it("detects steps from data and needs 3 materials for a price list", () => {
    const p = computeProgress({ ...empty, hasProfile: true, materials: 2, customers: 4 }, new Set());
    const byId = Object.fromEntries(p.steps.map((s) => [s.id, s]));
    expect(byId.profile.complete && byId.profile.auto).toBe(true);
    expect(byId.materials.complete).toBe(false);
    expect(byId.customer.complete).toBe(true);
    expect(p.next?.id).toBe("branding");
  });

  it("counts a hand-checked step but not as auto", () => {
    const p = computeProgress(empty, new Set(["branding"]));
    const branding = p.steps.find((s) => s.id === "branding")!;
    expect(branding.complete).toBe(true);
    expect(branding.auto).toBe(false);
    expect(p.doneRequired).toBe(1);
  });

  it("finishes at 100% without the optional steps, then offers them next", () => {
    const p = computeProgress(full, new Set());
    expect(p.allRequiredDone).toBe(true);
    expect(p.percent).toBe(100);
    expect(p.next?.optional).toBe(true);
  });
});

describe("per-business storage", () => {
  beforeEach(() => localStorage.clear());

  it("keeps hand-checked steps separate per business", () => {
    saveManual("a", new Set(["quickbooks"]));
    expect([...loadManual("a")]).toEqual(["quickbooks"]);
    expect(loadManual("b").size).toBe(0);
  });

  it("survives corrupt storage", () => {
    localStorage.setItem("fasttract.setup.manual.a", "{not json");
    expect(loadManual("a").size).toBe(0);
  });

  it("remembers a dismissed overview card", () => {
    expect(isCardDismissed("a")).toBe(false);
    setCardDismissed("a", true);
    expect(isCardDismissed("a")).toBe(true);
    setCardDismissed("a", false);
    expect(isCardDismissed("a")).toBe(false);
  });
});
