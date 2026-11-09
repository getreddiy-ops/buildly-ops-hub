import { describe, expect, it } from "vitest";
import { authEmailsFromHook, hookSecret, suppressionFromResendEvent } from "../../supabase/functions/_shared/auth-email";

const SB = "https://dtjgwculyctshyccsyne.supabase.co";

describe("Supabase send-email hook → emails", () => {
  it("builds a signup confirmation link through Supabase verify", () => {
    const [mail] = authEmailsFromHook({ user: { email: "a@b.co" }, email_data: { email_action_type: "signup", token_hash: "th1", token: "123456", redirect_to: "https://fasttract.org/app" } }, SB);
    expect(mail.to).toBe("a@b.co");
    const url = new URL(mail.confirmationUrl);
    expect(url.origin + url.pathname).toBe(`${SB}/auth/v1/verify`);
    expect(url.searchParams.get("token")).toBe("th1");
    expect(url.searchParams.get("type")).toBe("signup");
    expect(url.searchParams.get("redirect_to")).toBe("https://fasttract.org/app");
  });

  it("sends two messages for a secure email change, each to the right address", () => {
    const mails = authEmailsFromHook({ user: { email: "old@b.co", new_email: "new@b.co" }, email_data: { email_action_type: "email_change", token_hash: "for-new", token_hash_new: "for-current" } }, SB);
    expect(mails.map(m => [m.to, new URL(m.confirmationUrl).searchParams.get("token")])).toEqual([["old@b.co", "for-current"], ["new@b.co", "for-new"]]);
  });

  it("sends only the code for reauthentication", () => {
    const [mail] = authEmailsFromHook({ user: { email: "a@b.co" }, email_data: { email_action_type: "reauthentication", token: "654321" } }, SB);
    expect(mail).toMatchObject({ type: "reauthentication", token: "654321", confirmationUrl: "" });
  });

  it("rejects unknown types and missing tokens instead of sending a broken link", () => {
    expect(() => authEmailsFromHook({ user: { email: "a@b.co" }, email_data: { email_action_type: "nope", token_hash: "x" } }, SB)).toThrow(/Unknown/);
    expect(() => authEmailsFromHook({ user: { email: "a@b.co" }, email_data: { email_action_type: "recovery" } }, SB)).toThrow(/token hash/);
  });

  it("strips the v1, prefix from Supabase hook secrets", () => {
    expect(hookSecret("v1,whsec_abc")).toBe("whsec_abc");
    expect(hookSecret("whsec_abc")).toBe("whsec_abc");
  });
});

describe("Resend webhook → suppression", () => {
  it("suppresses permanent bounces and complaints only", () => {
    expect(suppressionFromResendEvent({ type: "email.bounced", data: { to: ["X@Y.co"], bounce: { type: "Permanent" } } })).toEqual({ email: "x@y.co", reason: "bounce" });
    expect(suppressionFromResendEvent({ type: "email.bounced", data: { to: ["x@y.co"], bounce: { type: "Transient" } } })).toBeNull();
    expect(suppressionFromResendEvent({ type: "email.complained", data: { to: "x@y.co" } })).toEqual({ email: "x@y.co", reason: "complaint" });
    expect(suppressionFromResendEvent({ type: "email.delivered", data: { to: ["x@y.co"] } })).toBeNull();
  });
});
