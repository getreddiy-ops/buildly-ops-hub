import { readFileSync } from "node:fs";
import { URL as NodeURL } from "node:url";
import ts from "typescript";
import { describe, it, expect, vi } from "vitest";

const source = readFileSync(new NodeURL("../../supabase/functions/mcp/index.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

function server(options: { openShift?: boolean; lineFailure?: boolean } = {}) {
  let handler!: (req: Request) => Promise<Response>;
  const calls: { table: string; method: string; query: URLSearchParams; body: any }[] = [];
  const fetcher = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "user-A" });
    const table = url.pathname.split("/").pop()!;
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ table, method, query: url.searchParams, body });
    if (["jobs", "invoices", "invoice_line_items", "time_entries"].includes(table)) {
      return Response.json({ message: "Legacy schema is incompatible" }, { status: 400 });
    }
    if (table === "organization_members") return Response.json([{ organization_id: "org-A", role: "owner" }]);
    if (table === "customers") return Response.json([{ id: "customer-A", name: "Customer A" }]);
    if (table === "org_jobs") return Response.json([{ id: "job-A", title: "Patio", ...body }]);
    if (table === "org_invoices") return Response.json([{ id: "invoice-A", number: "INV-A", status: "draft", total: 100, ...body }]);
    if (table === "org_invoice_line_items" && options.lineFailure) return Response.json({ message: "Line item rejected" }, { status: 400 });
    if (table === "contractor_time_entries") {
      return Response.json(method === "GET" ? (options.openShift ? [{ id: "shift-A", job_id: "job-A", job_title: "Patio", clock_in: "2026-10-06T08:00:00Z" }] : []) : [{ id: "shift-A", ...body }]);
    }
    return Response.json([]);
  });
  new Function("Deno", "fetch", code)({
    env: { get: (name: string) => name === "SUPABASE_URL" ? "https://test.invalid" : "test-key" },
    serve: (fn: typeof handler) => { handler = fn; },
  }, fetcher);
  const call = async (name: string, args: Record<string, unknown>) => {
    const response = await handler(new Request("https://test.invalid/mcp", {
      method: "POST", headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, method: "tools/call", params: { name, arguments: args } }),
    }));
    return (await response.json()).result;
  };
  return { call, calls };
}

describe("native MCP production schema", () => {
  it("creates a job in the customer's organization only after confirmation", async () => {
    const s = server();
    await s.call("create_job", { title: "Patio" });
    expect(s.calls.some(c => c.method === "POST")).toBe(false);
    const result = await s.call("create_job", { title: "Patio", confirm: true });
    expect(result.isError).not.toBe(true);
    expect(s.calls.find(c => c.method === "POST")?.body.organization_id).toBe("org-A");
  });
  it("lists organization-scoped jobs", async () => {
    const s = server();
    const result = await s.call("list_jobs", {});
    expect(result.isError).not.toBe(true);
    expect(s.calls.find(c => c.table === "org_jobs")?.query.get("organization_id")).toBe("eq.org-A");
  });
  it("stores invoice items with the newly created native invoice", async () => {
    const s = server();
    const result = await s.call("create_invoice", { customer_id: "customer-A", line_items: [{ description: "Concrete", quantity: 1, unit_price: 100 }], confirm: true });
    expect(result.isError).not.toBe(true);
    expect(s.calls.find(c => c.table === "org_invoice_line_items")?.body[0].invoice_id).toBe("invoice-A");
  });
  it("rolls back the native invoice if its items fail", async () => {
    const s = server({ lineFailure: true });
    const result = await s.call("create_invoice", { customer_id: "customer-A", line_items: [{ description: "Concrete", quantity: 1, unit_price: 100 }], confirm: true });
    expect(result.isError).toBe(true);
    expect(s.calls.find(c => c.method === "DELETE")?.table).toBe("org_invoices");
  });
  it("clocks into native time storage and retains the job title", async () => {
    const s = server();
    const result = await s.call("clock_in", { job_id: "job-A", confirm: true });
    expect(result.isError).not.toBe(true);
    expect(s.calls.find(c => c.table === "contractor_time_entries" && c.method === "POST")?.body).toMatchObject({ organization_id: "org-A", user_id: "user-A", job_title: "Patio" });
  });
  it("clocks out without relying on a nonexistent legacy job relation", async () => {
    const s = server({ openShift: true });
    const result = await s.call("clock_out", { confirm: true });
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toContain("Patio");
    const update = s.calls.find(c => c.method === "PATCH");
    expect(update?.table).toBe("contractor_time_entries");
    expect(update?.query.get("organization_id")).toBe("eq.org-A");
  });
});
