import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  decryptHighLevelCredential,
  isEncryptedHighLevelCredential,
} from "./_credential-crypto";

function json(res: any, status: number, body: unknown) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(status).json(body);
}

function readHeader(req: any, name: string) {
  const value = req?.headers?.[name.toLowerCase()];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

function secretsMatch(actual: string, expected: string) {
  const left = Buffer.from(actual, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function configured(name: string) {
  return typeof process.env[name] === "string" && Boolean(process.env[name]?.trim());
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "Method not allowed" });
  }

  const readinessSecret = process.env.FASTTRACT_READINESS_SECRET ?? "";
  const suppliedSecret = readHeader(req, "x-fasttract-readiness-secret");
  if (!readinessSecret || !secretsMatch(suppliedSecret, readinessSecret)) {
    return json(res, 404, { error: "Not found" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const required = [
    "GHL_APP_SHARED_SECRET",
    "GHL_CLIENT_ID",
    "GHL_CLIENT_SECRET",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GHL_TOKEN_ENCRYPTION_KEY",
  ];
  const missing = required.filter((name) => !configured(name));
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!configured("LOVABLE_API_KEY") && !configured("OPENAI_API_KEY")) {
    missing.push("LOVABLE_API_KEY or OPENAI_API_KEY");
  }

  const encryptionKey = process.env.GHL_TOKEN_ENCRYPTION_KEY ?? "";
  if (encryptionKey && encryptionKey.trim().length < 32) {
    return json(res, 503, {
      ok: false,
      error: "FastTract production encryption is not configured correctly.",
    });
  }

  if (missing.length > 0) {
    return json(res, 503, {
      ok: false,
      error: "FastTract production environment is incomplete.",
      missing,
    });
  }

  try {
    const admin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data, error } = await admin
      .from("ghl_connections")
      .select("id, connection_key, access_token, refresh_token, credential_version, credentials_encrypted_at, expires_at")
      .limit(1000);

    if (error) throw new Error(error.message);

    let encrypted = 0;
    let legacy = 0;
    let invalid = 0;

    for (const row of data ?? []) {
      try {
        decryptHighLevelCredential(row.access_token, encryptionKey);
        decryptHighLevelCredential(row.refresh_token, encryptionKey);

        if (
          isEncryptedHighLevelCredential(row.access_token)
          && isEncryptedHighLevelCredential(row.refresh_token)
          && row.credential_version === 1
        ) {
          encrypted += 1;
        } else {
          legacy += 1;
        }
      } catch {
        invalid += 1;
      }
    }

    if (invalid > 0) {
      return json(res, 503, {
        ok: false,
        error: "FastTract could not decrypt one or more stored HighLevel connections.",
        credentialStore: {
          connections: data?.length ?? 0,
          encrypted,
          legacy,
          invalid,
        },
      });
    }

    return json(res, 200, {
      ok: true,
      environment: "production-ready",
      credentialStore: {
        connections: data?.length ?? 0,
        encrypted,
        legacy,
        invalid,
        backfillRequired: legacy > 0,
      },
    });
  } catch (error) {
    console.error("FastTract readiness check failed", error);
    return json(res, 503, {
      ok: false,
      error: "FastTract could not verify its production credential store.",
    });
  }
}
