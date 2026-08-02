import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PhoneAssistant } from "./PhoneAssistant";

const invoke = vi.hoisted(() => vi.fn());
const assistantRow = vi.hoisted(() => ({ current: null as any }));

const readyAssistant = {
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
  number_source: null,
  setup_state: {},
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
      ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: assistantRow.current }) }) }) }
      : { select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) },
    functions: { invoke },
  },
}));

vi.mock("@elevenlabs/react", () => ({
  ConversationProvider: ({ children }: { children: React.ReactNode }) => children,
  useConversation: () => ({ status: "disconnected", isSpeaking: false, startSession: vi.fn(), endSession: vi.fn() }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

function mockDefaults() {
  invoke.mockImplementation(async (name: string, options: { body: Record<string, any> }) => {
    if (name === "phone-assistant") {
      return { data: { assistant: { ...readyAssistant, ...options.body } }, error: null };
    }
    if (name === "phone-assistant-provision") {
      if (options.body.action === "status") {
        return {
          data: {
            connected: false, phone_number: null, number_source: null,
            managed_by_fasttract: false, twilio_reachable: true,
            expected_webhook_url: "https://example.test/functions/v1/twilio-voice-webhook",
            voice_url: null, voice_url_ok: false, setup_state: {},
          },
          error: null,
        };
      }
      if (options.body.action === "search") {
        return {
          data: {
            numbers: [
              { phone_number: "+15035550123", friendly_name: "(503) 555-0123", locality: "Portland", region: "OR" },
              { phone_number: "+15035550999", friendly_name: "(503) 555-0999", locality: "Portland", region: "OR" },
            ],
            pricing_available: false,
          },
          error: null,
        };
      }
      if (options.body.action === "purchase") {
        return {
          data: { assistant: { ...readyAssistant, twilio_phone_number: options.body.phone_number } },
          error: null,
        };
      }
      if (options.body.action === "list_owned") {
        return { data: { numbers: [] }, error: null };
      }
    }
    return { data: {}, error: null };
  });
}

describe("Phone Assistant first run", () => {
  beforeEach(() => {
    sessionStorage.clear();
    invoke.mockReset();
    assistantRow.current = null;
    mockDefaults();
  });

  it("offers an enabled create button when no assistant exists", async () => {
    render(<PhoneAssistant />);
    const buttons = await screen.findAllByRole("button", { name: /Create my phone assistant/i });
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((b) => expect(b).toBeEnabled());
    expect(screen.queryByText("All changes saved")).not.toBeInTheDocument();
    expect(screen.getByText("Not created yet")).toBeInTheDocument();
  });

  it("creates the assistant with visible defaults and no fake edit first", async () => {
    render(<PhoneAssistant />);
    const button = (await screen.findAllByRole("button", { name: /Create my phone assistant/i }))[0];
    fireEvent.click(button);

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("phone-assistant", expect.anything()));
    const body = invoke.mock.calls.find((c) => c[0] === "phone-assistant")?.[1].body;
    expect(body.organization_id).toBe("org-1");
    expect(body.greeting).toContain("you have reached our office");
    expect(body.voice_id).toBe("EXAVITQu4vr4xnSDxMaL");
    expect(body.capabilities.capture_leads).toBe(true);
  });

  it("surfaces a configuration_missing error without exposing secret values", async () => {
    invoke.mockImplementation(async (name: string) =>
      name === "phone-assistant"
        ? { data: { error: "configuration_missing", missing: ["ELEVENLABS_API_KEY"] }, error: null }
        : { data: {}, error: null });

    render(<PhoneAssistant />);
    fireEvent.click((await screen.findAllByRole("button", { name: /Create my phone assistant/i }))[0]);

    const alert = await screen.findByText(/missing: ELEVENLABS_API_KEY/);
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).not.toMatch(/sk_|xi-api-key/);
  });
});

describe("Phone Assistant configuration saving", () => {
  beforeEach(() => {
    sessionStorage.clear();
    invoke.mockReset();
    assistantRow.current = readyAssistant;
    mockDefaults();
  });

  it("keeps a recovery draft immediately and saves the greeting when focus leaves the field", async () => {
    render(<PhoneAssistant />);
    const greeting = await screen.findByLabelText("Greeting script");

    fireEvent.change(greeting, { target: { value: "Thanks for calling Acme Roofing." } });
    expect(JSON.parse(sessionStorage.getItem("fasttract:phone-assistant-draft:org-1") ?? "{}").greeting)
      .toBe("Thanks for calling Acme Roofing.");

    fireEvent.blur(greeting);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("phone-assistant", expect.anything()));
    const call = invoke.mock.calls.filter((c) => c[0] === "phone-assistant").at(-1);
    expect(call?.[1].body.greeting).toBe("Thanks for calling Acme Roofing.");
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

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("phone-assistant", expect.anything()));
    const body = invoke.mock.calls.filter((c) => c[0] === "phone-assistant").at(-1)?.[1].body;
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

describe("Phone number setup", () => {
  beforeEach(() => {
    sessionStorage.clear();
    invoke.mockReset();
    assistantRow.current = readyAssistant;
    mockDefaults();
  });

  it("requires search, selection and confirmation before purchasing — never auto-buys", async () => {
    render(<PhoneAssistant />);
    fireEvent.click(await screen.findByRole("button", { name: /Search available numbers/i }));

    const option = await screen.findByRole("radio", { name: /555-0123/ });
    expect(invoke.mock.calls.some((c) => c[1]?.body?.action === "purchase")).toBe(false);

    fireEvent.click(option);
    fireEvent.click(await screen.findByRole("button", { name: /Review and connect this number/i }));

    // Confirmation modal shows the exact number, its type, and the fee disclosure.
    expect(await screen.findByText("Confirm this phone number")).toBeInTheDocument();
    expect(screen.getAllByText("+15035550123").length).toBeGreaterThan(0);
    expect(screen.getByText(/Carrier and telephony charges/i)).toBeInTheDocument();
    expect(invoke.mock.calls.some((c) => c[1]?.body?.action === "purchase")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /Confirm and connect/i }));
    await waitFor(() =>
      expect(invoke.mock.calls.some((c) => c[1]?.body?.action === "purchase")).toBe(true));
    const purchaseBody = invoke.mock.calls.find((c) => c[1]?.body?.action === "purchase")?.[1].body;
    expect(purchaseBody.phone_number).toBe("+15035550123");
    expect(purchaseBody.confirm_number).toBe("+15035550123");
  });

  it("does not claim the number is included with Premium", async () => {
    render(<PhoneAssistant />);
    await screen.findByRole("button", { name: /Search available numbers/i });
    expect(screen.queryByText(/Included with your Premium plan/i)).not.toBeInTheDocument();
    expect(screen.getByText(/not included in your FastTract plan/i)).toBeInTheDocument();
  });

  it("treats an already-connected response as success without buying twice", async () => {
    invoke.mockImplementation(async (name: string, options: { body: Record<string, any> }) => {
      if (name === "phone-assistant-provision" && options.body.action === "purchase") {
        return { data: { assistant: readyAssistant, already_connected: true }, error: null };
      }
      if (name === "phone-assistant-provision" && options.body.action === "search") {
        return { data: { numbers: [{ phone_number: "+15035550123", friendly_name: "(503) 555-0123" }] }, error: null };
      }
      return { data: {}, error: null };
    });

    render(<PhoneAssistant />);
    fireEvent.click(await screen.findByRole("button", { name: /Search available numbers/i }));
    fireEvent.click(await screen.findByRole("radio", { name: /555-0123/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Review and connect this number/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Confirm and connect/i }));

    await waitFor(() =>
      expect(invoke.mock.calls.filter((c) => c[1]?.body?.action === "purchase")).toHaveLength(1));
  });

  it("never presents a webhook URL as a call-forwarding destination", async () => {
    render(<PhoneAssistant />);
    const existingTab = await screen.findByRole("tab", { name: /Use my current business number/i });
    fireEvent.mouseDown(existingTab);
    fireEvent.click(existingTab);
    fireEvent.click(await screen.findByRole("button", { name: /Forward calls/i }));

    expect(await screen.findByText(/Connect an assistant number first/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("twilio-voice-webhook");
    expect(document.body.textContent).not.toContain("functions/v1");
    expect(screen.getByText(/carrier's official instructions|carrier's account portal/i)).toBeInTheDocument();
  });

  it("verifies Twilio ownership by listing account numbers instead of accepting free text", async () => {
    render(<PhoneAssistant />);
    const existingTab = await screen.findByRole("tab", { name: /Use my current business number/i });
    fireEvent.mouseDown(existingTab);
    fireEvent.click(existingTab);
    fireEvent.click(await screen.findByRole("button", { name: /Connect an existing Twilio number/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Load my Twilio numbers/i }));

    await waitFor(() =>
      expect(invoke.mock.calls.some((c) => c[1]?.body?.action === "list_owned")).toBe(true));
    expect(await screen.findByText(/No numbers found in the connected Twilio account/i)).toBeInTheDocument();
  });

  it("shows a porting checklist that does not promise an instant port", async () => {
    render(<PhoneAssistant />);
    const existingTab = await screen.findByRole("tab", { name: /Use my current business number/i });
    fireEvent.mouseDown(existingTab);
    fireEvent.click(existingTab);
    fireEvent.click(await screen.findByRole("button", { name: /Port an existing number/i }));

    expect(await screen.findByText(/It is not instant/i)).toBeInTheDocument();
    expect(screen.getByText(/Keep the old line active/i)).toBeInTheDocument();
  });
});

describe("Connected number", () => {
  beforeEach(() => {
    sessionStorage.clear();
    invoke.mockReset();
    assistantRow.current = { ...readyAssistant, twilio_phone_number: "+15035550123", twilio_phone_sid: "PN1", number_source: "purchased" };
    mockDefaults();
  });

  it("requires typing the exact number before release is enabled", async () => {
    render(<PhoneAssistant />);
    fireEvent.click(await screen.findByRole("button", { name: /Release number/i }));

    const confirmButtons = await screen.findAllByRole("button", { name: /^Release number$/i });
    const dialogButton = confirmButtons[confirmButtons.length - 1];
    expect(dialogButton).toBeDisabled();
    expect(screen.getByText(/may not be recoverable/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Type \+15035550123 to confirm/i), {
      target: { value: "+15035550123" },
    });
    await waitFor(() => expect(dialogButton).toBeEnabled());
  });
});
