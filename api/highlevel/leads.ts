import {
  addContactTags,
  ensureFastTractPipeline,
  FASTTRACT_CUSTOMER_TAG,
  FASTTRACT_HIDDEN_TAG,
  FASTTRACT_LEAD_TAG,
  getPipelineStage,
  highLevelRequest,
  json,
  removeContactTags,
  resolveHighLevelConnection,
  respondHighLevelError,
  type HighLevelPipeline,
} from "./_shared";

type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";

type LeadInput = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  source?: string | null;
  status?: LeadStatus;
  notes?: string | null;
  noteId?: string | null;
};

function deriveStatus(opportunity: any, pipeline: HighLevelPipeline): LeadStatus {
  if (opportunity?.status === "won") return "won";
  if (opportunity?.status === "lost" || opportunity?.status === "abandoned") return "lost";
  const stageName = pipeline.stages
    .find((stage) => stage.id === opportunity?.pipelineStageId)
    ?.name.toLowerCase();
  if (stageName === "contacted") return "contacted";
  if (stageName === "qualified") return "qualified";
  return "new";
}

function ghlOpportunityStatus(status: LeadStatus) {
  if (status === "won") return "won";
  if (status === "lost") return "lost";
  return "open";
}

function stageForStatus(
  pipeline: HighLevelPipeline,
  status: LeadStatus,
  currentStageId?: string,
) {
  if (status === "new" || status === "contacted" || status === "qualified") {
    return getPipelineStage(pipeline, status).id;
  }
  if (currentStageId && pipeline.stages.some((stage) => stage.id === currentStageId)) {
    return currentStageId;
  }
  return getPipelineStage(pipeline, "qualified").id;
}

function contactPayload(body: LeadInput) {
  return {
    name: body.name ?? null,
    email: body.email || null,
    phone: body.phone || null,
    address1: body.address || null,
    source: body.source || "FastTract",
  };
}

async function saveNote(contactId: string, body: LeadInput, token: string) {
  if (!body.notes?.trim()) return;
  if (body.noteId) {
    await highLevelRequest(
      `/contacts/${encodeURIComponent(contactId)}/notes/${encodeURIComponent(body.noteId)}`,
      {
        method: "PUT",
        token,
        body: { title: "FastTract lead note", body: body.notes.trim() },
      },
    );
    return;
  }

  await highLevelRequest(`/contacts/${encodeURIComponent(contactId)}/notes`, {
    method: "POST",
    token,
    body: { title: "FastTract lead note", body: body.notes.trim() },
  });
}

function toLead(opportunity: any, pipeline: HighLevelPipeline, contact?: any) {
  const linked = contact ?? opportunity?.contact ?? {};
  return {
    id: opportunity.id,
    contact_id: opportunity.contactId ?? linked.id,
    name: linked.name || opportunity.name || "Lead",
    email: linked.email ?? null,
    phone: linked.phone ?? null,
    address: linked.address1 ?? null,
    source: linked.source || opportunity.source || null,
    status: deriveStatus(opportunity, pipeline),
    notes: null,
    note_id: null,
    pipeline_id: opportunity.pipelineId,
    pipeline_stage_id: opportunity.pipelineStageId,
  };
}

export default async function handler(req: any, res: any) {
  try {
    const { locationId, token } = await resolveHighLevelConnection(req);
    const pipeline = await ensureFastTractPipeline(locationId, token);
    const opportunityId = typeof req.query?.id === "string" ? req.query.id : null;

    if (req.method === "GET" && opportunityId) {
      const opportunityResult = await highLevelRequest<{ opportunity: any }>(
        `/opportunities/${encodeURIComponent(opportunityId)}`,
        { token },
      );
      const opportunity = opportunityResult.opportunity;
      if (!opportunity?.contactId) {
        throw new Error("HighLevel opportunity is missing its linked contact");
      }
      if (opportunity.locationId && opportunity.locationId !== locationId) {
        return json(res, 403, { error: "Lead does not belong to this HighLevel sub-account" });
      }

      const [contactResult, notesResult] = await Promise.all([
        highLevelRequest<{ contact: any }>(
          `/contacts/${encodeURIComponent(opportunity.contactId)}`,
          { token },
        ),
        highLevelRequest<{ notes?: any[] }>(
          `/contacts/${encodeURIComponent(opportunity.contactId)}/notes`,
          { token },
        ),
      ]);
      const notes = notesResult.notes ?? [];
      const latestNote = notes[0] ?? null;
      return json(res, 200, {
        lead: {
          ...toLead(opportunity, pipeline, contactResult.contact),
          notes: latestNote?.body ?? null,
          note_id: latestNote?.id ?? null,
        },
      });
    }

    if (req.method === "GET") {
      const params = new URLSearchParams({
        locationId,
        pipelineId: pipeline.id,
        status: "all",
        page: String(Math.max(1, Number(req.query?.page || 1))),
        limit: String(Math.min(Math.max(1, Number(req.query?.limit || 100)), 100)),
        getNotes: "false",
        getTasks: "false",
        getCalendarEvents: "false",
      });
      if (typeof req.query?.q === "string" && req.query.q.trim()) {
        params.set("q", req.query.q.trim().slice(0, 75));
      }

      const result = await highLevelRequest<{ opportunities?: any[]; meta?: unknown }>(
        `/opportunities/search?${params.toString()}`,
        { token },
      );
      return json(res, 200, {
        leads: (result.opportunities ?? []).map((opportunity) => toLead(opportunity, pipeline)),
        meta: result.meta ?? null,
        pipeline,
      });
    }

    if (req.method === "POST") {
      const body: LeadInput = req.body && typeof req.body === "object" ? req.body : {};
      if (!body.name?.trim()) return json(res, 400, { error: "Name is required" });
      const status = body.status ?? "new";

      const contactResult = await highLevelRequest<{ contact: any }>("/contacts/upsert", {
        method: "POST",
        token,
        body: { ...contactPayload(body), locationId },
      });
      const contactId = contactResult.contact?.id;
      if (!contactId) throw new Error("HighLevel did not return a contact id");

      await addContactTags(contactId, [FASTTRACT_LEAD_TAG], token);
      await removeContactTags(contactId, [FASTTRACT_HIDDEN_TAG], token);
      await saveNote(contactId, body, token);

      const opportunityResult = await highLevelRequest<{ opportunity: any }>("/opportunities/", {
        method: "POST",
        token,
        body: {
          pipelineId: pipeline.id,
          locationId,
          name: body.name.trim(),
          pipelineStageId: stageForStatus(pipeline, status),
          status: ghlOpportunityStatus(status),
          contactId,
        },
      });

      if (status === "won") {
        await addContactTags(contactId, [FASTTRACT_CUSTOMER_TAG], token);
        await removeContactTags(contactId, [FASTTRACT_LEAD_TAG, FASTTRACT_HIDDEN_TAG], token);
      }

      return json(res, 201, {
        lead: toLead(opportunityResult.opportunity, pipeline, contactResult.contact),
      });
    }

    if (req.method === "PATCH") {
      if (!opportunityId) return json(res, 400, { error: "Missing lead id" });
      const status: LeadStatus = req.body?.status === "lost" ? "lost" : "won";
      const existing = await highLevelRequest<{ opportunity: any }>(
        `/opportunities/${encodeURIComponent(opportunityId)}`,
        { token },
      );
      if (existing.opportunity?.locationId && existing.opportunity.locationId !== locationId) {
        return json(res, 403, { error: "Lead does not belong to this HighLevel sub-account" });
      }
      const contactId = existing.opportunity?.contactId;
      if (!contactId) throw new Error("HighLevel lead is missing its contact");

      await highLevelRequest(`/opportunities/${encodeURIComponent(opportunityId)}/status`, {
        method: "PUT",
        token,
        body: { status: ghlOpportunityStatus(status) },
      });

      if (status === "won") {
        await addContactTags(contactId, [FASTTRACT_CUSTOMER_TAG], token);
        await removeContactTags(contactId, [FASTTRACT_LEAD_TAG, FASTTRACT_HIDDEN_TAG], token);
      }
      return json(res, 200, { success: true, status });
    }

    if (req.method === "PUT") {
      if (!opportunityId) return json(res, 400, { error: "Missing lead id" });
      const body: LeadInput = req.body && typeof req.body === "object" ? req.body : {};
      if (!body.name?.trim()) return json(res, 400, { error: "Name is required" });
      const status = body.status ?? "new";

      const existing = await highLevelRequest<{ opportunity: any }>(
        `/opportunities/${encodeURIComponent(opportunityId)}`,
        { token },
      );
      if (existing.opportunity?.locationId && existing.opportunity.locationId !== locationId) {
        return json(res, 403, { error: "Lead does not belong to this HighLevel sub-account" });
      }
      const contactId = existing.opportunity?.contactId;
      if (!contactId) throw new Error("HighLevel lead is missing its contact");

      const contactResult = await highLevelRequest<{ contact: any }>(
        `/contacts/${encodeURIComponent(contactId)}`,
        { method: "PUT", token, body: contactPayload(body) },
      );
      await saveNote(contactId, body, token);

      const opportunityResult = await highLevelRequest<{ opportunity: any }>(
        `/opportunities/${encodeURIComponent(opportunityId)}`,
        {
          method: "PUT",
          token,
          body: {
            pipelineId: pipeline.id,
            name: body.name.trim(),
            pipelineStageId: stageForStatus(
              pipeline,
              status,
              existing.opportunity.pipelineStageId,
            ),
            status: ghlOpportunityStatus(status),
          },
        },
      );

      if (status === "won") {
        await addContactTags(contactId, [FASTTRACT_CUSTOMER_TAG], token);
        await removeContactTags(contactId, [FASTTRACT_LEAD_TAG, FASTTRACT_HIDDEN_TAG], token);
      } else {
        await addContactTags(contactId, [FASTTRACT_LEAD_TAG], token);
        await removeContactTags(contactId, [FASTTRACT_HIDDEN_TAG], token);
      }

      return json(res, 200, {
        lead: toLead(opportunityResult.opportunity, pipeline, contactResult.contact),
      });
    }

    if (req.method === "DELETE") {
      if (!opportunityId) return json(res, 400, { error: "Missing lead id" });
      const existing = await highLevelRequest<{ opportunity: any }>(
        `/opportunities/${encodeURIComponent(opportunityId)}`,
        { token },
      );
      if (existing.opportunity?.locationId && existing.opportunity.locationId !== locationId) {
        return json(res, 403, { error: "Lead does not belong to this HighLevel sub-account" });
      }
      if (existing.opportunity?.contactId) {
        await addContactTags(existing.opportunity.contactId, [FASTTRACT_HIDDEN_TAG], token);
        await removeContactTags(existing.opportunity.contactId, [FASTTRACT_LEAD_TAG], token);
      }
      const result = await highLevelRequest(
        `/opportunities/${encodeURIComponent(opportunityId)}`,
        { method: "DELETE", token },
      );
      return json(res, 200, result);
    }

    res.setHeader("Allow", "GET, POST, PATCH, PUT, DELETE");
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return respondHighLevelError(res, error, "FastTract could not load or save that lead.");
  }
}
