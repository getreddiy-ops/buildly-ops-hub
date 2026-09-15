// Pushes a single FastTract lead/customer/job to GHL as a contact or
// appointment and stores the returned GHL id back on the record. Called
// fire-and-forget from the app right after a create/update.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  adminClient,
  createGhlAppointment,
  ensureFreshConnection,
  getConnectionForOrg,
  requiredSecret,
  updateGhlAppointment,
  upsertGhlContact,
} from "../_shared/ghl.ts";

type Entity = "lead" | "customer" | "job";
const ENTITY_TABLE: Record<Entity, string> = { lead: "leads", customer: "customers", job: "jobs" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const { organizationId, entity, id } = (await req.json()) as {
      organizationId?: string;
      entity?: Entity;
      id?: string;
    };
    if (!organizationId || !entity || !id || !ENTITY_TABLE[entity]) {
      return json(400, { error: "organizationId, entity, and id are required" });
    }

    const userClient = createClient(
      requiredSecret("SUPABASE_URL"),
      requiredSecret("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) return json(401, { error: "Unauthorized" });

    const admin = adminClient();
    const { data: membership } = await admin
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!membership) return json(403, { error: "Not a member of this organization" });

    let connection = await getConnectionForOrg(admin, organizationId);
    if (!connection) return json(200, { skipped: true, reason: "not_connected" });
    connection = await ensureFreshConnection(admin, connection);

    const { data: record, error: recordError } = await admin
      .from(ENTITY_TABLE[entity])
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (recordError || !record) return json(404, { error: "Record not found" });

    if (entity === "lead" || entity === "customer") {
      const contactId = await upsertGhlContact(connection, {
        name: record.name,
        email: record.email,
        phone: record.phone,
        address: record.address,
      });
      if (record.ghl_contact_id !== contactId) {
        await admin.from(ENTITY_TABLE[entity]).update({ ghl_contact_id: contactId }).eq("id", id);
      }
      return json(200, { synced: true, ghlContactId: contactId });
    }

    // job
    if (!connection.default_calendar_id) return json(200, { skipped: true, reason: "no_calendar" });
    if (!record.scheduled_start || !record.scheduled_end) {
      return json(200, { skipped: true, reason: "not_scheduled" });
    }

    let contactId: string | null = null;
    if (record.customer_id) {
      const { data: customer } = await admin
        .from("customers")
        .select("ghl_contact_id")
        .eq("id", record.customer_id)
        .maybeSingle();
      contactId = customer?.ghl_contact_id ?? null;
    }

    const fields = {
      title: record.title as string,
      startTime: record.scheduled_start as string,
      endTime: record.scheduled_end as string,
      contactId,
    };

    if (record.ghl_appointment_id) {
      await updateGhlAppointment(connection, record.ghl_appointment_id, fields);
      return json(200, { synced: true, ghlAppointmentId: record.ghl_appointment_id });
    }

    const appointmentId = await createGhlAppointment(connection, fields);
    await admin.from("jobs").update({ ghl_appointment_id: appointmentId }).eq("id", id);
    return json(200, { synced: true, ghlAppointmentId: appointmentId });
  } catch (error) {
    console.error("ghl-sync error:", error);
    return json(500, { error: String((error as Error).message) });
  }
});
