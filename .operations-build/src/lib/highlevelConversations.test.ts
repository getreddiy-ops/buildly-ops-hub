import { describe, expect, it } from "vitest";
import {
  conversationNeedsResponse,
  escapeMessageHtml,
  normalizeConversationChannel,
  sortConversations,
  sortMessages,
  validateOutboundMessage,
  type FastTractConversation,
  type FastTractMessage,
} from "./highlevelConversations";

function conversation(overrides: Partial<FastTractConversation> = {}): FastTractConversation {
  return {
    id: "conversation-1",
    contactId: "contact-1",
    contactName: "Morgan Customer",
    lastMessageBody: "Checking in",
    lastMessageType: "TYPE_SMS",
    lastMessageDirection: "outbound",
    lastMessageDate: "2026-09-01T10:00:00Z",
    unreadCount: 0,
    ...overrides,
  };
}

function message(overrides: Partial<FastTractMessage> = {}): FastTractMessage {
  return {
    id: "message-1",
    direction: "outbound",
    body: "Hello",
    dateAdded: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

describe("highlevelConversations", () => {
  it("normalizes HighLevel communication channels", () => {
    expect(normalizeConversationChannel("TYPE_SMS")).toBe("SMS");
    expect(normalizeConversationChannel("TYPE_CAMPAIGN_EMAIL")).toBe("Email");
    expect(normalizeConversationChannel("TYPE_CALL")).toBe("Call");
    expect(normalizeConversationChannel("TYPE_WEBCHAT")).toBe("Chat");
  });

  it("puts unread and inbound customer conversations first", () => {
    const rows = [
      conversation({ id: "old-outbound", contactName: "A", lastMessageDate: "2026-09-01T12:00:00Z" }),
      conversation({ id: "inbound", contactName: "B", lastMessageDirection: "inbound", lastMessageDate: "2026-09-01T09:00:00Z" }),
      conversation({ id: "unread", contactName: "C", unreadCount: 3, lastMessageDate: "2026-09-01T08:00:00Z" }),
    ];

    expect(sortConversations(rows).map((row) => row.id)).toEqual(["unread", "inbound", "old-outbound"]);
    expect(conversationNeedsResponse(rows[1])).toBe(true);
  });

  it("orders a customer timeline from oldest to newest", () => {
    const rows = [
      message({ id: "later", dateAdded: "2026-09-01T12:00:00Z" }),
      message({ id: "early", dateAdded: "2026-09-01T08:00:00Z" }),
    ];
    expect(sortMessages(rows).map((row) => row.id)).toEqual(["early", "later"]);
  });

  it("blocks the wrong outbound channel and incomplete email", () => {
    expect(validateOutboundMessage({
      channel: "SMS",
      message: "Hello",
      contact: { id: "contact-1", name: "Morgan", email: "morgan@example.com" },
    })).toContain("This customer does not have a phone number for SMS.");

    expect(validateOutboundMessage({
      channel: "Email",
      message: "Hello",
      subject: "",
      contact: { id: "contact-1", name: "Morgan", email: "morgan@example.com" },
    })).toContain("Add a subject before sending an email.");
  });

  it("accepts a reviewed message and safely escapes email HTML", () => {
    expect(validateOutboundMessage({
      channel: "Email",
      message: "Hi Morgan,\nYour estimate is ready.",
      subject: "Estimate update",
      contact: { id: "contact-1", email: "morgan@example.com" },
    })).toEqual([]);
    expect(escapeMessageHtml('<b>Hi & welcome</b>\nNext')).toBe("&lt;b&gt;Hi &amp; welcome&lt;/b&gt;<br />Next");
  });
});
