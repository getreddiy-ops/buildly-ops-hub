import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HighLevelJobs from "./Jobs";
import { highLevel } from "@/integrations/highlevel/client";

vi.mock("@/integrations/highlevel/client", () => ({
  highLevel: {
    listRecords: vi.fn(),
    listContacts: vi.fn(),
    bootstrap: vi.fn(),
    createRecord: vi.fn(),
  },
}));

const mockedHighLevel = vi.mocked(highLevel);

const job = {
  id: "job-1",
  properties: {
    job_name: "Fletcher stamped patio",
    status: "active",
    customer_id: "contact-1",
    address: "123 Oak Street",
    start_date: "2026-09-14",
    notes: "Remove the existing slab and place stamped concrete.",
  },
};

const timeEntry = {
  id: "time-1",
  properties: {
    description: "Morgan — 2026-09-14",
    job_id: "job-1",
    worker_name: "Morgan",
    work_date: "2026-09-14",
    hours: 8,
    labor_rate: 100,
    labor_cost: 800,
    notes: "Layout and demolition",
  },
};

const material = {
  id: "material-1",
  properties: {
    material_name: "Ready-mix concrete",
    job_id: "job-1",
    quantity: 5,
    unit: "yards",
    unit_cost: 120,
    supplier: "Local Ready Mix",
  },
};

describe("FastTract HighLevel Jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedHighLevel.listRecords.mockImplementation(async (object) => {
      if (object === "jobs") return { records: [job], total: 1 };
      if (object === "time_entries") return { records: [timeEntry], total: 1 };
      if (object === "materials") return { records: [material], total: 1 };
      return { records: [], total: 0 };
    });
    mockedHighLevel.listContacts.mockResolvedValue({
      contacts: [{ id: "contact-1", name: "Branden Fletcher" }],
      total: 1,
      count: 1,
    });
  });

  it("shows customer, hours, materials, and the combined tracked job cost", async () => {
    render(<HighLevelJobs />);

    expect(await screen.findByText("Fletcher stamped patio")).toBeInTheDocument();
    expect(screen.getByText("Branden Fletcher")).toBeInTheDocument();
    expect(screen.getAllByText("$1,400.00").length).toBeGreaterThan(0);

    expect(mockedHighLevel.listRecords).toHaveBeenCalledWith("jobs", { limit: 100 });
    expect(mockedHighLevel.listRecords).toHaveBeenCalledWith("time_entries", { limit: 100 });
    expect(mockedHighLevel.listRecords).toHaveBeenCalledWith("materials", { limit: 100 });
  });

  it("opens the job and exposes real crew-time and material details", async () => {
    render(<HighLevelJobs />);

    const jobCard = await screen.findByRole("button", { name: /Fletcher stamped patio/i });
    fireEvent.click(jobCard);

    expect(await screen.findByText("Tracked cost")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Crew time/i }));
    expect(await screen.findByText("Morgan")).toBeInTheDocument();
    expect(screen.getByText("Layout and demolition", { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText("$800.00").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^Materials$/i }));
    expect(await screen.findByText("Ready-mix concrete")).toBeInTheDocument();
    expect(screen.getByText("Local Ready Mix", { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText("$600.00").length).toBeGreaterThan(0);
  });

  it("offers setup instead of pretending the custom objects loaded", async () => {
    mockedHighLevel.listRecords.mockRejectedValueOnce(new Error("Custom objects are not ready"));
    render(<HighLevelJobs />);

    expect(await screen.findByText("Initialize the FastTract job workspace")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /Set up Jobs/i })).toBeEnabled());
  });
});
