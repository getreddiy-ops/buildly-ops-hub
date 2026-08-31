import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const PREFIX = "ft-ghl:v1:";
const APPLY = process.argv.includes("--apply");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function deriveKey(secret) {
  if (secret.trim().length < 32) {
    throw new Error("GHL_TOKEN_ENCRYPTION_KEY must contain at least 32 characters");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

function encrypt(value, secret) {
  if (value.startsWith(PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const sealed = Buffer.concat([ciphertext, cipher.getAuthTag()]);
  return `${PREFIX}${iv.toString("base64url")}.${sealed.toString("base64url")}`;
}

const admin = createClient(
  required("SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const encryptionKey = required("GHL_TOKEN_ENCRYPTION_KEY");

const { data: rows, error } = await admin
  .from("ghl_connections")
  .select("id, connection_key, access_token, refresh_token, credential_version");

if (error) throw new Error(`Could not read ghl_connections: ${error.message}`);

const pending = (rows ?? []).filter((row) =>
  !row.access_token?.startsWith(PREFIX)
  || !row.refresh_token?.startsWith(PREFIX)
  || row.credential_version !== 1
);

console.log(`HighLevel connections found: ${rows?.length ?? 0}`);
console.log(`Connections requiring encryption: ${pending.length}`);

if (!APPLY) {
  console.log("Dry run only. Re-run with --apply after reviewing the count.");
  process.exit(0);
}

for (const row of pending) {
  if (!row.access_token || !row.refresh_token) {
    throw new Error(`Connection ${row.connection_key ?? row.id} is missing a credential`);
  }

  const encryptedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from("ghl_connections")
    .update({
      access_token: encrypt(row.access_token, encryptionKey),
      refresh_token: encrypt(row.refresh_token, encryptionKey),
      credential_version: 1,
      credentials_encrypted_at: encryptedAt,
      updated_at: encryptedAt,
    })
    .eq("id", row.id)
    .eq("access_token", row.access_token)
    .eq("refresh_token", row.refresh_token);

  if (updateError) {
    throw new Error(`Could not encrypt ${row.connection_key ?? row.id}: ${updateError.message}`);
  }
  console.log(`Encrypted ${row.connection_key ?? row.id}`);
}

console.log(`Encryption backfill complete: ${pending.length} connection(s) processed.`);
