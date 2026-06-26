// Public webhook for ElevenLabs post-call data. Updates phone_calls with
// summary, transcript, and duration once the conversation ends.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const data = payload?.data ?? payload;
    const conversationId: string | undefined = data.conversation_id ?? data.id;
    const agentId: string | undefined = data.agent_id;
    if (!conversationId || !agentId) return new Response("ok");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: assistant } = await admin
      .from("phone_assistants").select("organization_id, twilio_phone_number")
      .eq("elevenlabs_agent_id", agentId).maybeSingle();
    if (!assistant) return new Response("ok");

    const meta = data.metadata ?? {};
    const analysis = data.analysis ?? {};
    const startedAt = meta.start_time_unix_secs ? new Date(meta.start_time_unix_secs * 1000).toISOString() : new Date().toISOString();
    const duration = meta.call_duration_secs ?? null;
    const endedAt = duration && meta.start_time_unix_secs ? new Date((meta.start_time_unix_secs + duration) * 1000).toISOString() : new Date().toISOString();
    const summary = analysis.transcript_summary ?? analysis.summary ?? null;

    // Update an in_progress row if present (matched by from/to), else insert
    const fromNumber = meta.phone_call?.external_number ?? null;
    const transcript = data.transcript ?? null;
    let updatedRow: { id: string } | null = null;
    if (fromNumber) {
      const { data: upd } = await admin
        .from("phone_calls")
        .update({
          ended_at: endedAt,
          duration_seconds: duration,
          status: "completed",
          summary,
          transcript,
          elevenlabs_conversation_id: conversationId,
        })
        .eq("organization_id", assistant.organization_id)
        .eq("status", "in_progress")
        .eq("from_number", fromNumber)
        .order("started_at", { ascending: false })
        .limit(1)
        .select("id")
        .maybeSingle();
      updatedRow = upd;
    }
    if (!updatedRow) {
      await admin.from("phone_calls").insert({
        organization_id: assistant.organization_id,
        from_number: fromNumber,
        to_number: assistant.twilio_phone_number,
        started_at: startedAt,
        ended_at: endedAt,
        duration_seconds: duration,
        status: "completed",
        summary,
        transcript,
        elevenlabs_conversation_id: conversationId,
      });
    }
    return new Response("ok");
  } catch (e) {
    console.error("postcall error", e);
    return new Response("ok"); // never fail the webhook
  }
});
