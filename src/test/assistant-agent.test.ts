import { describe, expect, it, vi } from "vitest";
import { runAgent, runReadTool, type AgentClient, type CallModel } from "../../supabase/functions/_shared/assistant-agent";

type Call = { table: string; ops: Array<[string, unknown[]]> };

// Chainable fake of the supabase-js query builder. `data` maps table -> rows.
function fakeClient(data: Record<string, Array<Record<string, unknown>>>) {
  const calls: Call[] = [];
  const client: AgentClient = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const q: Record<string, unknown> = {};
      for (const op of ["select", "eq", "neq", "in", "ilike", "gte", "lte", "lt", "order", "limit"]) {
        q[op] = (...args: unknown[]) => { call.ops.push([op, args]); return q; };
      }
      q.then = (resolve: (v: unknown) => unknown) => resolve({ data: data[table] ?? [], error: null });
      return q as unknown as ReturnType<AgentClient["from"]>;
    },
  };
  return { client, calls };
}

const toolCall = (id: string, name: string, args: Record<string, unknown>) => ({ id, type: "function" as const, function: { name, arguments: JSON.stringify(args) } });

describe("runReadTool", () => {
  it("scopes every query to the organization and escapes LIKE wildcards", async () => {
    const { client, calls } = fakeClient({ customers: [{ id: "c1", name: "100% Smith" }] });
    const out = await runReadTool(client, "org-A", "find_customers", { query: "100%_x", limit: 99 }) as { count: number; limited_to: number };
    expect(out.count).toBe(1);
    expect(out.limited_to).toBe(25);
    expect(calls[0].ops).toContainEqual(["eq", ["organization_id", "org-A"]]);
    expect(calls[0].ops).toContainEqual(["ilike", ["name", "%100\\%\\_x%"]]);
  });

  it("refuses to guess when a name matches several customers", async () => {
    const { client } = fakeClient({ customers: [{ id: "a", name: "John A" }, { id: "b", name: "John B" }] });
    const out = await runReadTool(client, "org-A", "get_customer", { name: "John" }) as { error: string; matches: unknown[] };
    expect(out.error).toMatch(/More than one customer/);
    expect(out.matches).toHaveLength(2);
  });

  it("computes outstanding and overdue balances for unpaid invoices", async () => {
    const { client } = fakeClient({ org_invoices: [
      { id: "i1", status: "sent", total: 1000, amount_paid: 250, due_date: "2026-11-01" },
      { id: "i2", status: "sent", total: 500, amount_paid: 500, due_date: "2026-12-01" },
      { id: "i3", status: "overdue", total: 300, amount_paid: 0, due_date: "2026-12-30" },
    ] });
    const out = await runReadTool(client, "org-A", "find_invoices", { unpaid_only: true }, new Date("2026-11-18T12:00:00Z")) as {
      invoices: Array<{ id: string; outstanding: number; overdue: boolean }>; total_outstanding_in_list: number;
    };
    expect(out.invoices.map((i) => i.id)).toEqual(["i1", "i3"]);
    expect(out.invoices[0]).toMatchObject({ outstanding: 750, overdue: true });
    expect(out.total_outstanding_in_list).toBe(1050);
  });

  it("totals job hours from approved hours and clock times, skipping rejected and open entries", async () => {
    const { client } = fakeClient({ time_entries: [
      { user_id: "u1", clock_in: "2026-11-10T08:00:00Z", clock_out: "2026-11-10T16:30:00Z", approved_hours: null, status: "pending" },
      { user_id: "u2", clock_in: "2026-11-10T08:00:00Z", clock_out: "2026-11-10T12:00:00Z", approved_hours: 3.5, status: "approved" },
      { user_id: "u2", clock_in: "2026-11-11T08:00:00Z", clock_out: "2026-11-11T20:00:00Z", approved_hours: null, status: "rejected" },
      { user_id: "u1", clock_in: "2026-11-18T08:00:00Z", clock_out: null, approved_hours: null, status: "pending" },
    ] });
    const out = await runReadTool(client, "org-A", "get_job_hours", { job_id: "j1" });
    expect(out).toMatchObject({ total_hours: 12, still_clocked_in: 1, workers: 2 });
  });
});

describe("runAgent", () => {
  const base = [{ role: "system" as const, content: "sys" }, { role: "user" as const, content: "Schedule a job for Smith" }];

  it("runs lookups itself, then pauses on a write proposal", async () => {
    const { client } = fakeClient({ customers: [{ id: "c1", name: "Dana Smith" }] });
    const callModel = vi.fn<CallModel>()
      .mockResolvedValueOnce({ message: { content: "", tool_calls: [toolCall("t1", "find_customers", { query: "Smith" })] }, usage: { prompt_tokens: 10, completion_tokens: 2 } })
      .mockResolvedValueOnce({ message: { content: "Found Dana Smith.", tool_calls: [toolCall("t2", "schedule_job", { customer_name: "Dana Smith", title: "Patio" })] }, usage: { prompt_tokens: 20, completion_tokens: 5 } });
    const result = await runAgent({ callModel, messages: base, client, organizationId: "org-A" });

    expect(result.steps).toEqual([expect.objectContaining({ name: "find_customers", summary: 'Searched customers matching "Smith" — 1 found' })]);
    expect(result.toolCalls).toEqual([{ id: "t2", name: "schedule_job", args: { customer_name: "Dana Smith", title: "Patio" } }]);
    expect(result.usage).toEqual({ promptTokens: 30, completionTokens: 7, calls: 2 });
    // The lookup result was fed back to the model as an untrusted tool message.
    const second = callModel.mock.calls[1][0];
    expect(second.at(-1)).toMatchObject({ role: "tool", tool_call_id: "t1" });
    expect(String((second.at(-1) as { content: string }).content)).toContain("untrusted_data");
  });

  it("forces a final answer once the step budget is spent", async () => {
    const { client } = fakeClient({});
    const callModel = vi.fn<CallModel>(async (_m, { allowTools }) => allowTools
      ? { message: { content: null, tool_calls: [toolCall(crypto.randomUUID(), "find_jobs", {})] } }
      : { message: { content: "Here is what I found." } });
    const result = await runAgent({ callModel, messages: base, client, organizationId: "org-A", maxSteps: 2 });
    expect(callModel).toHaveBeenCalledTimes(3);
    expect(callModel.mock.calls[2][1]).toEqual({ allowTools: false });
    expect(result).toMatchObject({ content: "Here is what I found.", toolCalls: [] });
    expect(result.steps).toHaveLength(2);
  });

  it("turns a failing lookup into an error result instead of crashing", async () => {
    const client: AgentClient = { from: () => { throw new Error("db down"); } };
    const callModel = vi.fn<CallModel>()
      .mockResolvedValueOnce({ message: { tool_calls: [toolCall("t1", "find_leads", {})] } })
      .mockResolvedValueOnce({ message: { content: "Leads are unavailable right now." } });
    const result = await runAgent({ callModel, messages: base, client, organizationId: "org-A" });
    expect(result.steps[0].summary).toMatch(/Lookup failed/);
    expect(result.content).toBe("Leads are unavailable right now.");
  });
});
