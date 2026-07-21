import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PhoneAssistant } from "./PhoneAssistant";

const invoke = vi.hoisted(() => vi.fn());

const initialAssistant = {
  id: "assistant-1",
  organization_id: "org-1",
  enabled: true,
  voice_id: "EXAVITQu4vr4xnSDxMaL",
  greeting: "Original greeting",
  transfer_number: null,
  capabilities: {
    book_estimates: true,
    capture_leads: true,
    sms_followup: false,
    transfer: true,
    voicemail: true,
    faq: true,
  },
  elevenlabs_agent_id: "agent-1",
  twilio_phone_number: null,
  twilio_phone_sid: null,
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ activeOrg: { organization_id: "org-1", role: "owner" } }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ isOwner: true }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => table === "phone_assistants"
      ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: initialAssistant }) }) }) }
      : { select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) },
    functions: { invoke },
  },
}));

vi.mock("@elevenlabs/react", () => ({
  ConversationProvider: ({ children }: { children: React.ReactNode }) => children,
  useConversation: () => ({ status: "disconnected", isSpeaking: false, startSession: vi.fn(), endSession: vi.fn() }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

describe("Phone Assistant automatic saving", () => {
  beforeEach(() => {
    sessionStorage.clear();
    invoke.mockReset();
    invoke.mockImplementation(async (_name: string, options: { body: Record<string, unknown> }) => ({
      data: { assistant: { ...initialAssistant, ...options.body } },
      error: null,
    }));
  });

  it("keeps a recovery draft immediately and saves the greeting when focus leaves the field", async () => {
    render(<PhoneAssistant />);
    const greeting = await screen.findByLabelText("Greeting script");

    fireEvent.change(greeting, { target: { value: "Thanks for calling Acme Roofing." } });
    expect(JSON.parse(sessionStorage.getItem("fasttract:phone-assistant-draft:org-1") ?? "{}").greeting)
      .toBe("Thanks for calling Acme Roofing.");

    fireEvent.blur(greeting);
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(invoke.mock.calls.at(-1)?.[1].body.greeting).toBe("Thanks for calling Acme Roofing.");
    await waitFor(() => expect(screen.getByText("All changes saved")).toBeInTheDocument());
  });

  it("saves every editable configuration value in one payload", async () => {
    render(<PhoneAssistant />);
    await screen.findByLabelText("Greeting script");

    fireEvent.click(screen.getByLabelText("Active"));
    fireEvent.change(screen.getByLabelText("Voice"), { target: { value: "9BWtsMINqrJLrRacOk9x" } });
    fireEvent.change(screen.getByLabelText("Transfer-to number"), { target: { value: "+15035550123" } });
    fireEvent.change(screen.getByLabelText("Greeting script"), { target: { value: "Welcome to Acme." } });
    fireEvent.click(screen.getByLabelText("Send SMS follow-up"));
    fireEvent.click(screen.getByRole("button", { name: "Save now" }));

    await waitFor(() => expect(invoke).toHaveBeenCalled());
    const body = invoke.mock.calls.at(-1)?.[1].body;
    expect(body).toMatchObject({
      organization_id: "org-1",
      enabled: false,
      voice_id: "9BWtsMINqrJLrRacOk9x",
      greeting: "Welcome to Acme.",
      transfer_number: "+15035550123",
    });
    expect(body.capabilities).toMatchObject({ sms_followup: true });
  });
});
