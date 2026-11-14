import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AiConnectionCard } from "./AiConnectionCard";

const { state, invoke, refetch } = vi.hoisted(() => ({
  state: { role: "owner", connection: null as null | Record<string, unknown> },
  invoke: vi.fn(async () => ({ data: { connected: true }, error: null })),
  refetch: vi.fn(async () => {}),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ activeOrg: { organization_id: "org-1", role: state.role } }) }));
vi.mock("@/hooks/useAiConnection", () => ({ useAiConnection: () => ({ connection: state.connection, loading: false, refetch, orgId: "org-1" }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("AI provider settings", () => {
  beforeEach(() => { vi.clearAllMocks(); state.role = "owner"; state.connection = null; });

  it("lets an owner connect a provider; the key goes to connect-ai and is cleared", async () => {
    render(<AiConnectionCard />);
    fireEvent.click(screen.getByRole("button", { name: "Anthropic (Claude)" }));
    const key = screen.getByLabelText("API key") as HTMLInputElement;
    fireEvent.change(key, { target: { value: "sk-ant-abcdefghijklmnopqrstuvwxyz" } });
    fireEvent.click(screen.getByRole("button", { name: "Check and connect" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("connect-ai", { body: { organizationId: "org-1", provider: "anthropic", model: undefined, apiKey: "sk-ant-abcdefghijklmnopqrstuvwxyz" } }));
    await waitFor(() => expect(key.value).toBe(""));
  });

  it("shows a connected provider by its last four characters only", () => {
    state.connection = { provider: "openai", model: "gpt-4o-mini", key_last4: "9xYz", status: "connected", last_error: null, verified_at: null };
    render(<AiConnectionCard />);
    expect(screen.getByText(/••••9xYz/)).toBeInTheDocument();
    expect(screen.queryByLabelText("API key")).not.toBeInTheDocument();
  });

  it("hides the form from crew members", () => {
    state.role = "worker";
    render(<AiConnectionCard />);
    expect(screen.queryByLabelText("API key")).not.toBeInTheDocument();
    expect(screen.getByText(/Ask the business owner/)).toBeInTheDocument();
  });
});
