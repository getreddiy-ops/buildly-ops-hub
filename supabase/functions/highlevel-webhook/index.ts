import { createClient } from "npm:@supabase/supabase-js@2";

// HighLevel's current webhook signing key (Ed25519).
// Source: https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/
const GHL_PUBLIC_KEY_SPKI_BASE64 =
  "MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=";

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function verifyGhlSignature(rawBody: string, signature: string): Promise<boolean> {
  try {
    const publicKey = await crypto.subtle.importKey(
      "spki",
      base64ToBytes(GHL_PUBLIC_KEY_SPKI_BASE64),
      { name: "Ed25519" },
      false,
      ["verify"],
    );

    return await crypto.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      base64ToBytes(signature),
      new TextEncoder().encode(rawBody),
    );
  } catch (error) {
    console.error("Could not verify HighLevel webhook signature:", error);
    return false;
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function removeUninstalledConnections(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
) {
  const eventType = readString(payload, "type")?.toUpperCase();
  if (eventType !== "UNINSTALL") return;

  const locationId = readString(payload, "locationId");
  const companyId = readString(payload, "companyId");
  const installType = readString(payload, "installType")?.toLowerCase();

  if (locationId && installType !== "company" && installType !== "agency") {
    const { error } = await supabase
      .from("ghl_connections")
      .delete()
      .eq("location_id", locationId);
    if (error) throw new Error(`Could not remove uninstalled location credentials: ${error.message}`);
    return;
  }

  if (companyId) {
    const { error } = await supabase
      .from("ghl_connections")
      .delete()
      .eq("company_id", companyId);
    if (error) throw new Error(`Could not remove uninstalled company credentials: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-ghl-signature");

  if (!signature || !(await verifyGhlSignature(rawBody, signature))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const webhookId =
    readString(payload, "webhookId")
    ?? `sha256:${await sha256Hex(rawBody)}`;
  const eventType = readString(payload, "type") ?? "unknown";
  const locationId = readString(payload, "locationId");
  const companyId = readString(payload, "companyId");

  const { error } = await supabase.from("highlevel_events").upsert(
    {
      webhook_id: webhookId,
      event_type: eventType,
      location_id: locationId,
      company_id: companyId,
      payload,
      received_at: new Date().toISOString(),
    },
    { onConflict: "webhook_id", ignoreDuplicates: true },
  );

  if (error) {
    console.error("Could not persist HighLevel webhook:", error);
    return new Response("Webhook persistence failed", { status: 500 });
  }

  try {
    await removeUninstalledConnections(supabase, payload);
  } catch (error) {
    console.error("Could not deprovision HighLevel installation:", error);
    return new Response("Webhook deprovisioning failed", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
});
