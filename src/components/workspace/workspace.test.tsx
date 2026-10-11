import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WorkspacePreview from "@/pages/WorkspacePreview";
import { activeWorkspaceGroup, workspaceGroups } from "./navigation";
import { afterEach } from "vitest";
afterEach(cleanup);
describe("Workspace organization", () => {
  it("keeps nested records in their parent section", () => {
    expect(activeWorkspaceGroup("/app/jobs/example").label).toBe("Jobs");
    expect(activeWorkspaceGroup("/app/estimates/example").label).toBe("Money");
    expect(activeWorkspaceGroup("/app/settings").label).toBe("Company");
  });
  it("keeps all existing office destinations accessible", () => {
    const paths = workspaceGroups.flatMap(g => g.items.map(i => i.to));
    for (const path of ["jobs", "customers", "leads", "messages", "estimates", "invoices", "contracts", "time", "crew", "vendors", "materials", "costing", "approvals", "calendar", "settings", "business-profile", "branding", "billing", "phone-assistant", "command-center"]) expect(paths).toContain(`/app/${path}`);
  });
  it("filters sample job folders and opens the matching project", () => {
    render(<MemoryRouter initialEntries={["/workspace-preview?section=%2Fapp%2Fjobs"]}><WorkspacePreview /></MemoryRouter>);
    fireEvent.change(screen.getByRole("textbox", { name: "Search sample folders" }), { target: { value: "Casey" } });
    expect(screen.queryByText("Backyard patio")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Casey Parker.*Driveway replacement/i }));
    expect(screen.getByRole("heading", { name: "Driveway replacement" })).toBeInTheDocument();
    expect(screen.getByText("Scope of work")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Invoices" }), { button: 0, ctrlKey: false });
    expect(screen.getByText("No invoices are linked to this job yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All job folders" }));
    expect(screen.getByRole("heading", { name: "Your job folders." })).toBeInTheDocument();
  });
});
