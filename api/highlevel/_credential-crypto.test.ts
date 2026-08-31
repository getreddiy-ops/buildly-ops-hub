import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptHighLevelCredential,
  encryptHighLevelCredential,
  isEncryptedHighLevelCredential,
} from "./_credential-crypto";

const SECRET = "0123456789abcdef0123456789abcdef";
const PREFIX = "ft-ghl:v1:";

function toBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

async function encryptLikeSupabaseEdge(value: string, secret: string) {
  const digest = await webcrypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  const key = await webcrypto.subtle.importKey(
    "raw",
    digest,
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    new TextEncoder().encode(value),
  ));
  return `${PREFIX}${toBase64Url(iv)}.${toBase64Url(sealed)}`;
}

describe("HighLevel credential encryption", () => {
  it("round-trips a credential without exposing plaintext", () => {
    const value = "pit-live-token-example";
    const encrypted = encryptHighLevelCredential(value, SECRET);

    expect(isEncryptedHighLevelCredential(encrypted)).toBe(true);
    expect(encrypted).not.toContain(value);
    expect(decryptHighLevelCredential(encrypted, SECRET)).toEqual({
      value,
      encrypted: true,
    });
  });

  it("reads legacy plaintext so it can be migrated safely", () => {
    expect(decryptHighLevelCredential("legacy-token", SECRET)).toEqual({
      value: "legacy-token",
      encrypted: false,
    });
  });

  it("rejects the wrong encryption key", () => {
    const encrypted = encryptHighLevelCredential("refresh-token", SECRET);
    expect(() => decryptHighLevelCredential(encrypted, `${SECRET}-wrong`)).toThrow();
  });

  it("decrypts the AES-GCM envelope produced by the Supabase Edge runtime", async () => {
    const value = "rotating-refresh-token";
    const encrypted = await encryptLikeSupabaseEdge(value, SECRET);
    expect(decryptHighLevelCredential(encrypted, SECRET).value).toBe(value);
  });
});
