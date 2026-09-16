// Builds the GoHighLevel authorize URL for an org admin/owner to connect
// their location. The organizationId travels in a signed, expiring `state`
// so ghl-oauth-callback can trust it without a server-side session.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  DEFAULT_GHL_SCOPES,
  GHL_AUTHORIZE_URL,
  adminClient,
  requiredSecret,
  signOAuthState,
} from "../_shared/ghl.ts";

const DEFAULT_REDIRECT_URI =
  "https://ohqopzyggxmwentbgivb.supabase.co/functions/v1/ghl-oauth-callback";

const REQUIRED_FASTTRACT_SCOPES = [
  "contacts.readonly",
  "contacts.write",
  "opportunities.readonly",
  "opportunities.write",
  "locations.readonly",
  "users.readonly",
  "calendars.readonly",
  "calendars/events.readonly",
  "calendars/events.write",
  "conversations.readonly",
  "conversations.write",
  "conversations/message.readonly",
  "conversations/message.write",
  "invoices.readonly",
  "invoices.write",
  "invoices/estimate.readonly",
  "invoices/estimate.write",
];

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

    const { organizationId } = (await req.json()) as { organizationId?: string };
    if (!organizationId) return json(400, { error: "organizationId is required" });

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
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return json(403, { error: "Only an organization owner or admin can connect HighLevel" });
    }

    const state = await signOAuthState(requiredSecret("GHL_STATE_SECRET"), organizationId);
    const redirectUri = Deno.env.get("GHL_REDIRECT_URI") ?? DEFAULT_REDIRECT_URI;
    const configuredScopes = (Deno.env.get("GHL_SCOPES") ?? DEFAULT_GHL_SCOPES)
      .split(/\s+/)
      .filter(Boolean);
    const scopes = [...new Set([...configuredScopes, ...REQUIRED_FASTTRACT_SCOPES])].join(" ");

    const url = new URL(GHL_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", requiredSecret("GHL_CLIENT_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes);
    url.searchParams.set("state", state);

    return json(200, { url: url.toString() });
  } catch (error) {
    console.error("ghl-oauth-start error:", error);
    return json(500, { error: String((error as Error).message) });
  }
});
