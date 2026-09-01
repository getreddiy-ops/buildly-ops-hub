export type FastTractMessageChannel = "SMS" | "Email";
export type FastTractMessageDirection = "inbound" | "outbound";

export type FastTractConversation = {
  id: string;
  contactId: string;
  locationId?: string;
  contactName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  lastMessageBody?: string;
  lastMessageType?: string;
  lastMessageDirection?: FastTractMessageDirection;
  lastMessageDate?: string;
  unreadCount: number;
  status?: string;
};

export type FastTractMessage = {
  id: string;
  conversationId?: string;
  contactId?: string;
  locationId?: string;
  type?: string;
  direction: FastTractMessageDirection;
  status?: string;
  body: string;
  subject?: string;
  dateAdded?: string;
  createdAt?: string;
  attachments?: string[];
};

export type OutboundMessageContact = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type OutboundMessageDraft = {
  channel: FastTractMessageChannel;
  message: string;
  subject?: string;
  contact: OutboundMessageContact;
};

function asTimestamp(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function conversationName(conversation: FastTractConversation) {
  return conversation.contactName
    || conversation.fullName
    || conversation.email
    || conversation.phone
    || "Unknown customer";
}

export function normalizeConversationChannel(value?: string | null) {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized.includes("EMAIL")) return "Email";
  if (normalized.includes("CALL") || normalized.includes("PHONE") || normalized.includes("VOICEMAIL")) return "Call";
  if (normalized.includes("SMS") || normalized.includes("TEXT")) return "SMS";
  if (normalized.includes("WEBCHAT") || normalized.includes("LIVE_CHAT")) return "Chat";
  if (normalized.includes("FACEBOOK") || normalized === "FB") return "Facebook";
  if (normalized.includes("INSTAGRAM") || normalized === "IG") return "Instagram";
  if (normalized.includes("WHATSAPP")) return "WhatsApp";
  return "Message";
}

export function normalizeMessageDirection(value?: string | null): FastTractMessageDirection {
  return String(value ?? "").toLowerCase() === "inbound" ? "inbound" : "outbound";
}

export function conversationNeedsResponse(conversation: FastTractConversation) {
  return conversation.unreadCount > 0 || conversation.lastMessageDirection === "inbound";
}

export function sortConversations(conversations: FastTractConversation[]) {
  return [...conversations].sort((a, b) => {
    const aNeedsResponse = conversationNeedsResponse(a) ? 1 : 0;
    const bNeedsResponse = conversationNeedsResponse(b) ? 1 : 0;
    if (aNeedsResponse !== bNeedsResponse) return bNeedsResponse - aNeedsResponse;
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
    return asTimestamp(b.lastMessageDate) - asTimestamp(a.lastMessageDate)
      || conversationName(a).localeCompare(conversationName(b));
  });
}

export function sortMessages(messages: FastTractMessage[]) {
  return [...messages].sort((a, b) => {
    const aDate = asTimestamp(a.dateAdded || a.createdAt);
    const bDate = asTimestamp(b.dateAdded || b.createdAt);
    return aDate - bDate || a.id.localeCompare(b.id);
  });
}

export function outboundChannelAvailability(contact: OutboundMessageContact) {
  return {
    SMS: Boolean(contact.phone?.trim()),
    Email: Boolean(contact.email?.trim()),
  };
}

export function validateOutboundMessage(draft: OutboundMessageDraft) {
  const errors: string[] = [];
  const message = draft.message.trim();
  const subject = draft.subject?.trim() ?? "";
  const available = outboundChannelAvailability(draft.contact);

  if (!draft.contact.id.trim()) errors.push("Choose a real HighLevel customer before sending.");
  if (!message) errors.push("Write the customer message before sending.");
  if (message.length > 8_000) errors.push("Keep the message under 8,000 characters.");

  if (draft.channel === "SMS") {
    if (!available.SMS) errors.push("This customer does not have a phone number for SMS.");
    if (message.length > 1_600) errors.push("Keep SMS messages under 1,600 characters.");
  }

  if (draft.channel === "Email") {
    if (!available.Email) errors.push("This customer does not have an email address.");
    if (!subject) errors.push("Add a subject before sending an email.");
    if (subject.length > 250) errors.push("Keep the email subject under 250 characters.");
  }

  return [...new Set(errors)];
}

export function escapeMessageHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\r?\n/g, "<br />");
}

export function messagePreview(value?: string | null, limit = 110) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}
