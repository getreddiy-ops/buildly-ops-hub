import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HighLevelApprovals from "./Approvals";
import { highLevel } from "@/integrations/highlevel/client";

vi.mock("@/contexts/HighLevelContext", () => ({
  useHighLevel: () => ({
    connection: {
      connected: true,
      mode: "embedded",
      locationId: "location-a",
      user: { id: "user-1", name: "Morgan" },
    },
  }),
}));

vi.mock("@/integrations/highlevel/client", () => ({
  highLevel: {
    listRecords: vi.fn(),
    updateRecord: vi.fn(),
    bootstrap: vi.fn(),
  },
}));

const mockedHighLevel = vi.mocked(highLevel);

const approval = {
  id: "approval-1",
  updatedAt: "2026-09-01T12:00:00Z",
  properties: {
    approval_name: "Review patio estimate",
    status: "pending",
    intent: "create_estimate",
    risk_level: "financial",
    summary: "Ava prepared a patio estimate for review.",
    next_step: "Verify quantities and prices before saving.",
    missing_information: '["Verified concrete price"]',
    route: "/highlevel/estimates?edit=estimate-1",
    source_prompt: "Build the Fletcher patio estimate",
    created_by_name: "Morgan",
  },
};

function renderApprovals() {
  return render(
    <MemoryRouter initialEntries={["/highlevel/approvals"]}>
      <HighLevelApprovals />
    </MemoryRouter>,
  );
}

describe("FastTract Ava approvals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedHighLevel.listRecords.mockResolvedValue({ records: [approval], total: 1 });
    mockedHighLevel.updateRecord.mockResolvedValue({
      record: { ...approval, properties: { ...approval.properties, status: "in_review" } },
    });
    mockedHighLevel.bootstrap.mockResolvedValue({
      ok: true,
      created: [],
      skipped: [],
      locationId: "location-a",
    });
  });

  it("shows the review queue without claiming the action is complete", async () => {
    renderApprovals();

    expect(await screen.findByText("Review patio estimate")).toBeInTheDocument();
    expect(screen.getByText("Ava never approves Ava")).toBeInTheDocument();
    expect(screen.getByText("Waiting for review")).toBeInTheDocument();
    expect(screen.getByText("Financial action")).toBeInTheDocument();
  });

  it("moves a pending action into review before opening its dedicated workspace", async () => {
    renderApprovals();

    fireEvent.click(await screen.findByRole("button", { name: "Begin review" }));

    await waitFor(() => expect(mockedHighLevel.updateRecord).toHaveBeenCalledWith(
      "ava_actions",
      "approval-1",
      expect.objectContaining({
        properties: expect.objectContaining({ status: "in_review" }),
      }),
    ));
  });

  it("offers location setup when approval actions are not initialized", async () => {
    mockedHighLevel.listRecords.mockRejectedValueOnce(new Error("Approval Actions are not ready"));
    renderApprovals();

    expect(await screen.findByText("Initialize Ava’s approval center")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Set up approval center/i })).toBeEnabled();
  });
});
