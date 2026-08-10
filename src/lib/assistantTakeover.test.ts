import { describe, expect, it } from "vitest";
import {
  collectFastTractScreenContext,
  resolveTakeoverRoute,
  TAKEOVER_ROUTES,
} from "./assistantTakeover";

describe("FastTract Screen Takeover", () => {
  it("allows navigation only to the fixed FastTract route list", () => {
    expect(resolveTakeoverRoute("/app/leads")).toEqual({ path: "/app/leads", label: "Leads" });
    expect(resolveTakeoverRoute("https://example.com")).toBeNull();
    expect(resolveTakeoverRoute("/admin")).toBeNull();
    expect(new Set(TAKEOVER_ROUTES.map((route) => route.path)).size).toBe(TAKEOVER_ROUTES.length);
  });

  it("collects visible page labels without input values, secrets, or assistant content", () => {
    document.title = "Leads | FastTract";
    document.body.innerHTML = `
      <main data-fasttract-page>
        <h1>Leads</h1>
        <button aria-label="Add lead">New</button>
        <label for="search">Search customers</label>
        <input id="search" value="private customer name" />
        <button>Reveal API key</button>
        <div id="floating-assistant-root"><button>Assistant-only action</button></div>
      </main>
    `;

    const context = collectFastTractScreenContext(document, "/app/leads");

    expect(context).toEqual({
      path: "/app/leads",
      title: "Leads | FastTract",
      visibleControls: ["Leads", "Add lead", "Search customers"],
    });
    expect(JSON.stringify(context)).not.toContain("private customer name");
    expect(JSON.stringify(context)).not.toContain("Assistant-only action");
  });
});
