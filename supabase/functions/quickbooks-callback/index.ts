// Intuit redirects here after the owner approves FastTract in QuickBooks. Public (verify_jwt = false):
// the signed `state` proves which business and user started the connection.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyState } from "../_shared/quickbooks-map.ts";
import { exchangeToken, qbConfig } from "../_shared/quickbooks.ts";

function back(path: string) {
  const app = (Deno.env.get("PUBLIC_APP_URL") || "https://www.fasttract.org").replace(/\/$/, "");
  return Response.redirect(`${app}${path}`, 302);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const err = url.searchParams.get("error");
  if (err) return back(`/app/settings?quickbooks=declined#quickbooks`);
  if (!code || !realmId) return back(`/app/settings?quickbooks=error#quickbooks`);

  try {
    const { clientSecret, redirectUri, env } = qbConfig();
    const state = await verifyState(url.searchParams.get("state") ?? "", clientSecret);
    if (!state) return back(`/app/settings?quickbooks=expired#quickbooks`);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isAdmin } = await admin.rpc("is_org_admin", { _user_id: state.user, _org_id: state.org });
    if (!isAdmin) return back(`/app/settings?quickbooks=forbidden#quickbooks`);

    const t = await exchangeToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
    const { error } = await admin.from("quickbooks_connections").upsert({
      organization_id: state.org, realm_id: realmId, access_token: t.access_token, refresh_token: t.refresh_token,
      token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(), environment: env, connected_by: state.user,
    }, { onConflict: "organization_id" });
    if (error) throw error;
    return back(`/app/settings?quickbooks=connected#quickbooks`);
  } catch (e) {
    console.error("quickbooks-callback error", e);
    return back(`/app/settings?quickbooks=error#quickbooks`);
  }
});
