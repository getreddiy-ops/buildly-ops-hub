import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ManualTimeEntry } from "./ManualTimeEntry";
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, from } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
beforeEach(() => {
  rpc.mockReset(); from.mockReset();
  from.mockImplementation((table: string) => {
    const result = { data: table === "organization_members" ? [{user_id:"owner"},{user_id:"employee"}] : table === "org_jobs" ? [{id:"job",title:"Completed driveway",status:"completed"}] : [{id:"owner",full_name:"Morgan"},{id:"employee",full_name:"Branden"}], error:null };
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue(result), in: vi.fn().mockResolvedValue(result), then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return chain;
  });
});
async function fillForm() {
  fireEvent.click(screen.getByRole("button",{name:"Add past time"}));
  await screen.findByRole("option",{name:"Branden"});
  expect(screen.getByRole("option",{name:"Morgan (me)"})).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Worker"),{target:{value:"employee"}});
  fireEvent.change(screen.getByLabelText("Job"),{target:{value:"job"}});
  fireEvent.change(screen.getByLabelText("Start date and time"),{target:{value:"2026-01-05T08:00"}});
  fireEvent.change(screen.getByLabelText("End date and time"),{target:{value:"2026-01-05T16:00"}});
  fireEvent.change(screen.getByLabelText("Note (optional)"),{target:{value:"Forgot to clock in"}});
}
describe("manual time form", () => {
  it("saves an employee's past time on a completed company job", async () => {
    rpc.mockResolvedValue({data:"saved-id",error:null});
    const saved = vi.fn();
    render(<ManualTimeEntry organizationId="company" actorId="owner" onSaved={saved} />);
    await fillForm();
    expect(screen.getByText("Total: 8.00 hours")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Save past time"}));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(rpc).toHaveBeenCalledWith("record_manual_job_time",expect.objectContaining({p_organization_id:"company",p_user_id:"employee",p_job_id:"job",p_clock_in:new Date("2026-01-05T08:00").toISOString(),p_note:"Forgot to clock in"}));
  });
  it("keeps a rejected entry visible and reuses its request ID on retry", async () => {
    rpc.mockResolvedValue({data:null,error:{message:"This worker already has time recorded during that period"}});
    const saved = vi.fn();
    render(<ManualTimeEntry organizationId="company" actorId="owner" onSaved={saved} />);
    await fillForm(); fireEvent.click(screen.getByRole("button",{name:"Save past time"}));
    expect(await screen.findByRole("alert")).toHaveTextContent(/already has time/);
    expect(saved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Save past time"}));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
    expect(rpc.mock.calls[0][1].p_entry_id).toBe(rpc.mock.calls[1][1].p_entry_id);
  });
});
