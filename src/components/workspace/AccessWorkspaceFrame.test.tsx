import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { WorkspaceFrame } from "./AccessWorkspaceFrame";

function Workspace() {
  const { pathname } = useLocation();
  return <WorkspaceFrame path={pathname} name="Test owner" company="Test company"><h1>Current record: {pathname}</h1></WorkspaceFrame>;
}

describe("Access-style workspace", () => {
  it("filters navigation objects and switches and closes document tabs", () => {
    render(<MemoryRouter initialEntries={["/app/branding"]}><Workspace /></MemoryRouter>);
    // The test environment can be narrow; show the navigation pane if needed.
    if (!screen.queryByRole("navigation", { name: "Workspace" })) {
      fireEvent.click(screen.getByRole("button", { name: "Show navigation pane" }));
    }
    const navigation = screen.getByRole("navigation", { name: "Workspace" });
    fireEvent.change(screen.getByRole("textbox", { name: "Search workspace objects" }), { target: { value: "customer" } });
    expect(within(navigation).getByRole("link", { name: "All customers" })).toBeVisible();
    expect(within(navigation).queryByRole("link", { name: "Materials" })).not.toBeInTheDocument();
    fireEvent.click(within(navigation).getByRole("link", { name: "All customers" }));
    expect(screen.getByRole("heading", { name: "Current record: /app/customers" })).toBeVisible();
    const tabs = screen.getByLabelText("Open workspace documents");
    fireEvent.click(within(tabs).getByRole("link", { name: "Brand & documents" }));
    expect(screen.getByRole("heading", { name: "Current record: /app/branding" })).toBeVisible();
    fireEvent.click(within(tabs).getByRole("button", { name: "Close Brand & documents" }));
    expect(screen.getByRole("heading", { name: "Current record: /app/customers" })).toBeVisible();
    expect(within(tabs).queryByRole("link", { name: "Brand & documents" })).not.toBeInTheDocument();
  });
});
