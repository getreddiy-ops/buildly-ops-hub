// Backs the Preferences integration card: reports whether an org has a live
// HighLevel connection, lets an owner/admin disconnect it, lets them pick
// which GHL calendar outbound job sync writes appointments to, and lets them
// pick which GHL user Send Invoice records as the sender.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  adminClient,
  ensureFreshConnection,
  getConnectionForOrg,
  listGhlLocationUsers,
  requiredSecret,
} from "../_shared/ghl.ts";

type Action = "status" | "disconnect" | "set_calendar" | "set_pipeline_map" | "set_sender_user_id" | "list_users";

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

    const { organizationId, action, calendarId, pipelineStageMap, senderUserId } = (await req.json()) as {
      organizationId?: string;
      action?: Action;
      calendarId?: string;
      pipelineStageMap?: Record<string, string>;
      senderUserId?: string;
    };
    if (!organizationId || !action) return json(400, { error: "organizationId and action are required" });

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

    if (action === "status") {
      const { data } = await admin
        .from("ghl_connections")
        .select("location_id, company_id, installed_at, default_calendar_id, pipeline_stage_map, default_sender_user_id")
        .eq("organization_id", organizationId)
        .maybeSingle();
      return json(200, {
        connected: !!data,
        locationId: data?.location_id ?? null,
        companyId: data?.company_id ?? null,
        installedAt: data?.installed_at ?? null,
        defaultCalendarId: data?.default_calendar_id ?? null,
        pipelineStageMap: data?.pipeline_stage_map ?? {},
        defaultSenderUserId: data?.default_sender_user_id ?? null,
      });
    }

    if (action === "list_users") {
      const connection = await getConnectionForOrg(admin, organizationId);
      if (!connection) return json(400, { error: "No HighLevel connection for this organization" });
      try {
        const users = await listGhlLocationUsers(await ensureFreshConnection(admin, connection));
        return json(200, { users });
      } catch (fetchError) {
        return json(502, { error: `Could not list HighLevel users: ${(fetchError as Error).message}` });
      }
    }

    const isAdmin = ["owner", "admin"].includes(membership.role);
    if (!isAdmin) return json(403, { error: "Only an organization owner or admin can manage this" });

    if (action === "disconnect") {
      const { error } = await admin.from("ghl_connections").delete().eq("organization_id", organizationId);
      if (error) return json(500, { error: error.message });
      return json(200, { connected: false });
    }

    if (action === "set_calendar") {
      const { error } = await admin
        .from("ghl_connections")
        .update({ default_calendar_id: calendarId || null, updated_at: new Date().toISOString() })
        .eq("organization_id", organizationId);
      if (error) return json(500, { error: error.message });
      return json(200, { defaultCalendarId: calendarId || null });
    }

    if (action === "set_sender_user_id") {
      const { error } = await admin
        .from("ghl_connections")
        .update({ default_sender_user_id: senderUserId || null, updated_at: new Date().toISOString() })
        .eq("organization_id", organizationId);
      if (error) return json(500, { error: error.message });
      return json(200, { defaultSenderUserId: senderUserId || null });
    }

    if (action === "set_pipeline_map") {
      const map = pipelineStageMap ?? {};
      const validStatuses = new Set(["new", "contacted", "qualified", "won", "lost"]);
      for (const value of Object.values(map)) {
        if (!validStatuses.has(value)) {
          return json(400, { error: `Invalid status "${value}" — must be one of new, contacted, qualified, won, lost` });
        }
      }
      const { error } = await admin
        .from("ghl_connections")
        .update({ pipeline_stage_map: map, updated_at: new Date().toISOString() })
        .eq("organization_id", organizationId);
      if (error) return json(500, { error: error.message });
      return json(200, { pipelineStageMap: map });
    }

    return json(400, { error: "Unknown action" });
  } catch (error) {
    console.error("ghl-connection error:", error);
    return json(500, { error: String((error as Error).message) });
  }
});
