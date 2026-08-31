import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const HIGHLEVEL_CREDENTIAL_PREFIX = "ft-ghl:v1:";

function deriveKey(secret: string) {
  if (secret.trim().length < 32) {
    throw new Error("GHL_TOKEN_ENCRYPTION_KEY must contain at least 32 characters");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

export function isEncryptedHighLevelCredential(value: string) {
  return value.startsWith(HIGHLEVEL_CREDENTIAL_PREFIX);
}

export function encryptHighLevelCredential(value: string, secret: string) {
  if (!value) throw new Error("Cannot encrypt an empty HighLevel credential");

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const sealed = Buffer.concat([ciphertext, cipher.getAuthTag()]);

  return `${HIGHLEVEL_CREDENTIAL_PREFIX}${iv.toString("base64url")}.${sealed.toString("base64url")}`;
}

export function decryptHighLevelCredential(value: string, secret: string) {
  if (!isEncryptedHighLevelCredential(value)) {
    return { value, encrypted: false } as const;
  }

  const envelope = value.slice(HIGHLEVEL_CREDENTIAL_PREFIX.length);
  const [ivPart, sealedPart, ...extra] = envelope.split(".");
  if (!ivPart || !sealedPart || extra.length > 0) {
    throw new Error("Invalid encrypted HighLevel credential envelope");
  }

  const iv = decodeBase64Url(ivPart);
  const sealed = decodeBase64Url(sealedPart);
  if (iv.length !== 12 || sealed.length <= 16) {
    throw new Error("Invalid encrypted HighLevel credential payload");
  }

  const authTag = sealed.subarray(sealed.length - 16);
  const ciphertext = sealed.subarray(0, sealed.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  return { value: plaintext, encrypted: true } as const;
}
