import {
  addContactTags,
  FASTTRACT_CUSTOMER_TAG,
  FASTTRACT_HIDDEN_TAG,
  FASTTRACT_LEAD_TAG,
  highLevelRequest,
  json,
  removeContactTags,
  resolveHighLevelConnection,
  respondHighLevelError,
} from "./_shared";

type ContactInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  address1?: string | null;
  notes?: string | null;
};

function toContactPayload(body: ContactInput) {
  return {
    name: body.name ?? null,
    email: body.email ?? null,
    phone: body.phone ?? null,
    address1: body.address1 ?? body.address ?? null,
    source: "FastTract",
  };
}

async function addNote(contactId: string, notes: unknown, token: string) {
  if (typeof notes !== "string" || !notes.trim()) return null;
  return highLevelRequest(`/contacts/${encodeURIComponent(contactId)}/notes`, {
    method: "POST",
    token,
    body: { title: "FastTract note", body: notes.trim() },
  });
}

export default async function handler(req: any, res: any) {
  try {
    const { locationId, token } = await resolveHighLevelConnection(req);
    const contactId = typeof req.query?.id === "string" ? req.query.id : null;

    if (req.method === "GET" && contactId) {
      const [contactResult, notesResult] = await Promise.all([
        highLevelRequest<{ contact: any }>(`/contacts/${encodeURIComponent(contactId)}`, { token }),
        highLevelRequest<{ notes?: any[] }>(`/contacts/${encodeURIComponent(contactId)}/notes`, { token }),
      ]);

      if (contactResult.contact?.locationId && contactResult.contact.locationId !== locationId) {
        return json(res, 403, { error: "Contact does not belong to this HighLevel sub-account" });
      }

      const notes = notesResult.notes ?? [];
      return json(res, 200, { contact: contactResult.contact, notes, latestNote: notes[0] ?? null });
    }

    if (req.method === "GET") {
      const page = Math.max(1, Number(req.query?.page || 1));
      const pageLimit = Math.min(Math.max(1, Number(req.query?.limit || 100)), 100);
      const query = typeof req.query?.q === "string" ? req.query.q.trim().slice(0, 100) : "";

      const result = await highLevelRequest<{
        contacts?: any[];
        total?: number;
        count?: number;
        meta?: unknown;
      }>("/contacts/search", {
        method: "POST",
        token,
        body: {
          locationId,
          page,
          pageLimit,
          ...(query ? { query } : {}),
        },
      });

      const contacts = (result.contacts ?? []).filter((contact) => {
        const tags = Array.isArray(contact.tags)
          ? contact.tags.filter((tag: unknown): tag is string => typeof tag === "string").map((tag) => tag.toLowerCase())
          : [];
        const isFastTractLead = tags.includes(FASTTRACT_LEAD_TAG);
        const isFastTractCustomer = tags.includes(FASTTRACT_CUSTOMER_TAG);
        return isFastTractCustomer || !isFastTractLead;
      });

      return json(res, 200, { ...result, contacts, count: contacts.length });
    }

    if (req.method === "POST") {
      const body: ContactInput = req.body && typeof req.body === "object" ? req.body : {};
      const result = await highLevelRequest<{ contact: any }>("/contacts/upsert", {
        method: "POST",
        token,
        body: { ...toContactPayload(body), locationId },
      });

      const createdContactId = result.contact?.id;
      if (!createdContactId) throw new Error("HighLevel did not return a contact id");

      await addContactTags(createdContactId, [FASTTRACT_CUSTOMER_TAG], token);
      await removeContactTags(createdContactId, [FASTTRACT_HIDDEN_TAG], token);
      await addNote(createdContactId, body.notes, token);
      return json(res, 200, result);
    }

    if (req.method === "PUT") {
      if (!contactId) return json(res, 400, { error: "Missing contact id" });
      const body: ContactInput = req.body && typeof req.body === "object" ? req.body : {};

      const existing = await highLevelRequest<{ contact: any }>(`/contacts/${encodeURIComponent(contactId)}`, { token });
      if (existing.contact?.locationId && existing.contact.locationId !== locationId) {
        return json(res, 403, { error: "Contact does not belong to this HighLevel sub-account" });
      }

      const result = await highLevelRequest<{ contact: any }>(`/contacts/${encodeURIComponent(contactId)}`, {
        method: "PUT",
        token,
        body: toContactPayload(body),
      });

      await addContactTags(contactId, [FASTTRACT_CUSTOMER_TAG], token);
      await removeContactTags(contactId, [FASTTRACT_HIDDEN_TAG], token);
      await addNote(contactId, body.notes, token);
      return json(res, 200, result);
    }

    if (req.method === "DELETE") {
      if (!contactId) return json(res, 400, { error: "Missing contact id" });
      const existing = await highLevelRequest<{ contact: any }>(`/contacts/${encodeURIComponent(contactId)}`, { token });
      if (existing.contact?.locationId && existing.contact.locationId !== locationId) {
        return json(res, 403, { error: "Contact does not belong to this HighLevel sub-account" });
      }

      await addContactTags(contactId, [FASTTRACT_HIDDEN_TAG], token);
      await removeContactTags(contactId, [FASTTRACT_CUSTOMER_TAG], token);
      return json(res, 200, { succeeded: true, preservedInHighLevel: true });
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return respondHighLevelError(res, error, "FastTract could not load or save that customer.");
  }
}
