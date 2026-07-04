// End-to-end test for the ai-assistant edge function.
// Provisions a throwaway user + org + Plus subscription, signs in,
// hits the DEPLOYED function URL, asserts structured response, and cleans up.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/ai-assistant`;

function uniq() {
  return crypto.randomUUID().slice(0, 8);
}

Deno.test("ai-assistant e2e: authenticated, subscribed user gets structured response", async () => {
  assert(SUPABASE_URL && SUPABASE_ANON_KEY && SERVICE_ROLE, "env vars required");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = `ai-e2e-${uniq()}@example.test`;
  const password = `Pw!${crypto.randomUUID()}`;
  let userId = "";
  let orgId = "";
  let subId = "";

  try {
    // 1. Create confirmed user
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert(!cErr, `createUser: ${cErr?.message}`);
    userId = created.user!.id;

    // 2. Create org + membership + active Plus subscription
    const { data: org, error: oErr } = await admin
      .from("organizations")
      .insert({ name: `E2E Org ${uniq()}`, owner_id: userId, plan: "plus" })
      .select("id")
      .single();
    assert(!oErr, `org insert: ${oErr?.message}`);
    orgId = org!.id;

    const { error: mErr } = await admin
      .from("organization_members")
      .insert({ organization_id: orgId, user_id: userId, role: "owner" });
    assert(!mErr, `member insert: ${mErr?.message}`);

    const { data: sub, error: sErr } = await admin
      .from("subscriptions")
      .insert({
        user_id: userId,
        organization_id: orgId,
        paddle_subscription_id: `test_sub_${uniq()}`,
        paddle_customer_id: `test_cus_${uniq()}`,
        product_id: "contractor_os_plus",
        price_id: "contractor_os_plus_monthly",
        status: "active",
        environment: "live",
        current_period_end: new Date(Date.now() + 30 * 86400_000).toISOString(),
      })
      .select("id")
      .single();
    assert(!sErr, `sub insert: ${sErr?.message}`);
    subId = sub!.id;

    // 3. Sign in as that user to get an access token
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signIn, error: siErr } = await anon.auth.signInWithPassword({ email, password });
    assert(!siErr, `signIn: ${siErr?.message}`);
    const accessToken = signIn.session!.access_token;

    // 4. Call the deployed edge function
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        organizationId: orgId,
        environment: "live",
        orgName: "E2E Org",
        messages: [
          {
            role: "user",
            content:
              "Reply with exactly the words: PING OK. Do not call any tools. No punctuation beyond that.",
          },
        ],
      }),
    });

    const bodyText = await res.text();
    console.log("status", res.status);
    console.log("body", bodyText.slice(0, 800));
    assertEquals(res.status, 200, `expected 200, got ${res.status}: ${bodyText}`);

    const data = JSON.parse(bodyText);
    assert("content" in data, "response missing `content`");
    assert(Array.isArray(data.tool_calls), "response missing `tool_calls` array");
    assert(
      typeof data.content === "string" && data.content.length > 0,
      `expected non-empty content, got: ${JSON.stringify(data.content)}`,
    );
    assert(
      /PING\s*OK/i.test(data.content),
      `expected model to echo PING OK, got: ${data.content}`,
    );
  } finally {
    // Cleanup — order matters for FKs
    if (subId) await admin.from("subscriptions").delete().eq("id", subId);
    if (orgId) {
      await admin.from("organization_members").delete().eq("organization_id", orgId);
      await admin.from("organizations").delete().eq("id", orgId);
    }
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});

Deno.test("ai-assistant e2e: unauthenticated request is rejected", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({
      messages: [{ role: "user", content: "hi" }],
      organizationId: crypto.randomUUID(),
      environment: "live",
    }),
  });
  const body = await res.text();
  assertEquals(res.status, 401, `expected 401, got ${res.status}: ${body}`);
});

Deno.test("ai-assistant e2e: authenticated user without subscription is 402", async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `ai-e2e-nosub-${uniq()}@example.test`;
  const password = `Pw!${crypto.randomUUID()}`;
  let userId = "";
  let orgId = "";
  try {
    const { data: created } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    userId = created.user!.id;

    const { data: org } = await admin
      .from("organizations")
      .insert({ name: `E2E NoSub ${uniq()}`, owner_id: userId, plan: "free" })
      .select("id").single();
    orgId = org!.id;
    await admin.from("organization_members")
      .insert({ organization_id: orgId, user_id: userId, role: "owner" });

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signIn } = await anon.auth.signInWithPassword({ email, password });
    const accessToken = signIn.session!.access_token;

    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        organizationId: orgId,
        environment: "live",
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    const body = await res.text();
    assertEquals(res.status, 402, `expected 402, got ${res.status}: ${body}`);
    const data = JSON.parse(body);
    assertEquals(data.code, "subscription_required");
  } finally {
    if (orgId) {
      await admin.from("organization_members").delete().eq("organization_id", orgId);
      await admin.from("organizations").delete().eq("id", orgId);
    }
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
