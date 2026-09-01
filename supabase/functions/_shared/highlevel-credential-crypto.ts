const HIGHLEVEL_CREDENTIAL_PREFIX = "ft-ghl:v1:";

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function deriveKey(secret: string) {
  if (secret.trim().length < 32) {
    throw new Error("GHL_TOKEN_ENCRYPTION_KEY must contain at least 32 characters");
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey(
    "raw",
    digest,
    "AES-GCM",
    false,
    ["encrypt"],
  );
}

export async function encryptHighLevelCredential(value: string, secret: string) {
  if (!value) throw new Error("Cannot encrypt an empty HighLevel credential");

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    await deriveKey(secret),
    new TextEncoder().encode(value),
  ));

  return `${HIGHLEVEL_CREDENTIAL_PREFIX}${toBase64Url(iv)}.${toBase64Url(sealed)}`;
}
