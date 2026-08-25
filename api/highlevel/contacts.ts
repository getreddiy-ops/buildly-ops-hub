import {
  addContactTags,
  FASTTRACT_CUSTOMER_TAG,
  getHighLevelLocationId,
  highLevelRequest,
  json,
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

async function addNote(contactId: string, notes: unknown) {
  if (typeof notes !== "string" || !notes.trim()) return null;
  return highLevelRequest(`/contacts/${encodeURIComponent(contactId)}/notes`, {
    method: "POST",
    body: {
      title: "FastTract note",
      body: notes.trim(),
    },
  });
}

export default async function handler(req: any, res: any) {
  try {
    const locationId = getHighLevelLocationId();
    const contactId = typeof req.query?.id === "string" ? req.query.id : null;

    if (req.method === "GET" && contactId) {
      const [contactResult, notesResult] = await Promise.all([
        highLevelRequest<{ contact: any }>(
          `/contacts/${encodeURIComponent(contactId)}`,
        ),
        highLevelRequest<{ notes?: any[] }>(
          `/contacts/${encodeURIComponent(contactId)}/notes`,
        ),
      ]);

      const notes = notesResult.notes ?? [];
      return json(res, 200, {
        contact: contactResult.contact,
        notes,
        latestNote: notes[0] ?? null,
      });
    }

    if (req.method === "GET") {
      const params = new URLSearchParams({
        locationId,
        page: String(Number(req.query?.page || 1)),
        limit: String(Math.min(Number(req.query?.limit || 100), 100)),
      });

      if (typeof req.query?.q === "string" && req.query.q.trim()) {
        params.set("q", req.query.q.trim().slice(0, 75));
      }

      const result = await highLevelRequest<{
        contacts?: any[];
        total?: number;
        count?: number;
        meta?: unknown;
      }>(`/contacts/search?${params.toString()}`);

      const contacts = (result.contacts ?? []).filter((contact) =>
        Array.isArray(contact.tags)
          ? contact.tags.some(
              (tag: unknown) =>
                typeof tag === "string" &&
                tag.toLowerCase() === FASTTRACT_CUSTOMER_TAG,
            )
          : false,
      );

      return json(res, 200, {
        ...result,
        contacts,
        count: contacts.length,
      });
    }

    if (req.method === "POST") {
      const body: ContactInput =
        req.body && typeof req.body === "object" ? req.body : {};
      const result = await highLevelRequest<{ contact: any }>(
        "/contacts/upsert",
        {
          method: "POST",
          body: {
            ...toContactPayload(body),
            locationId,
          },
        },
      );

      const createdContactId = result.contact?.id;
      if (!createdContactId) {
        throw new Error("HighLevel did not return a contact id");
      }

      await addContactTags(createdContactId, [FASTTRACT_CUSTOMER_TAG]);
      await addNote(createdContactId, body.notes);
      return json(res, 200, result);
    }

    if (req.method === "PUT") {
      if (!contactId) return json(res, 400, { error: "Missing contact id" });
      const body: ContactInput =
        req.body && typeof req.body === "object" ? req.body : {};

      const result = await highLevelRequest<{ contact: any }>(
        `/contacts/${encodeURIComponent(contactId)}`,
        {
          method: "PUT",
          body: toContactPayload(body),
        },
      );

      await addContactTags(contactId, [FASTTRACT_CUSTOMER_TAG]);
      await addNote(contactId, body.notes);
      return json(res, 200, result);
    }

    if (req.method === "DELETE") {
      if (!contactId) return json(res, 400, { error: "Missing contact id" });
      const result = await highLevelRequest(
        `/contacts/${encodeURIComponent(contactId)}`,
        { method: "DELETE" },
      );
      return json(res, 200, result);
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Unknown HighLevel error",
    });
  }
}
