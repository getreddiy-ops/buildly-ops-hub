import { createClient } from "npm:@supabase/supabase-js@2";
import { encryptHighLevelCredential } from "../_shared/highlevel-credential-crypto.ts";

const TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";
const DEFAULT_REDIRECT_URI =
  "https://ohqopzyggxmwentbgivb.supabase.co/functions/v1/ghl-oauth-callback";
const DEFAULT_SUCCESS_URL = "https://fasttract.org/app/preferences?ghl=connected";
const DEFAULT_ERROR_URL = "https://fasttract.org/app/preferences?ghl=error";

type HighLevelToken = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  userType?: string;
  companyId?: string;
  locationId?: string;
  userId?: string;
  refreshTokenId?: string;
};

function redirect(url: string) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function requiredSecret(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET" },
    });
  }

  const requestUrl = new URL(req.url);
  const successUrl = Deno.env.get("GHL_SUCCESS_URL") ?? DEFAULT_SUCCESS_URL;
  const errorUrl = Deno.env.get("GHL_ERROR_URL") ?? DEFAULT_ERROR_URL;

  const providerError = requestUrl.searchParams.get("error");
  const code = requestUrl.searchParams.get("code");
  if (providerError || !code) {
    console.error("HighLevel authorization did not return a code", providerError);
    return redirect(errorUrl);
  }

  try {
    const redirectUri = Deno.env.get("GHL_REDIRECT_URI") ?? DEFAULT_REDIRECT_URI;
    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: requiredSecret("GHL_CLIENT_ID"),
        client_secret: requiredSecret("GHL_CLIENT_SECRET"),
        grant_type: "authorization_code",
        code,
        user_type: Deno.env.get("GHL_USER_TYPE") ?? "Location",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      await tokenResponse.body?.cancel();
      throw new Error(`HighLevel token exchange failed (${tokenResponse.status})`);
    }

    const token = (await tokenResponse.json()) as HighLevelToken;
    if (!token.access_token || !token.refresh_token) {
      throw new Error("HighLevel token response is missing credentials");
    }

    const userType = token.userType ?? Deno.env.get("GHL_USER_TYPE") ?? "Location";
    const resourceId = token.locationId ?? token.companyId;
    if (!resourceId) throw new Error("HighLevel token response is missing an account identifier");

    const admin = createClient(
      requiredSecret("SUPABASE_URL"),
      requiredSecret("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const expiresAt = new Date(
      Date.now() + Math.max(0, token.expires_in ?? 86400) * 1000,
    ).toISOString();
    const connectionKey = `${userType.toLowerCase()}:${resourceId}`;
    const encryptionKey = requiredSecret("GHL_TOKEN_ENCRYPTION_KEY");
    const encryptedAt = new Date().toISOString();

    const [accessToken, refreshToken] = await Promise.all([
      encryptHighLevelCredential(token.access_token, encryptionKey),
      encryptHighLevelCredential(token.refresh_token, encryptionKey),
    ]);

    const { error } = await admin.from("ghl_connections").upsert({
      connection_key: connectionKey,
      access_token: accessToken,
      refresh_token: refreshToken,
      credential_version: 1,
      credentials_encrypted_at: encryptedAt,
      token_type: token.token_type ?? "Bearer",
      scope: token.scope ?? "",
      user_type: userType,
      company_id: token.companyId ?? null,
      location_id: token.locationId ?? null,
      ghl_user_id: token.userId ?? null,
      refresh_token_id: token.refreshTokenId ?? null,
      expires_at: expiresAt,
      installed_at: encryptedAt,
      updated_at: encryptedAt,
    }, { onConflict: "connection_key" });

    if (error) throw new Error(`Could not save HighLevel connection: ${error.message}`);
    return redirect(successUrl);
  } catch (error) {
    console.error("HighLevel OAuth callback failed", error);
    return redirect(errorUrl);
  }
});
