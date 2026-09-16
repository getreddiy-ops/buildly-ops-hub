import { describe, expect, it } from "vitest";
import { availableGhlSendChannels } from "./ghl";

describe("availableGhlSendChannels", () => {
  it("offers only email when the customer has an email but no phone", () => {
    expect(availableGhlSendChannels({ email: "a@example.com", phone: null })).toEqual(["email"]);
  });

  it("offers only sms when the customer has a phone but no email", () => {
    expect(availableGhlSendChannels({ email: null, phone: "+15551234567" })).toEqual(["sms"]);
  });

  it("offers all three channels when both are on file", () => {
    expect(availableGhlSendChannels({ email: "a@example.com", phone: "+15551234567" })).toEqual([
      "email",
      "sms",
      "sms_and_email",
    ]);
  });

  it("never silently offers a channel with no contact info at all", () => {
    expect(availableGhlSendChannels({ email: null, phone: null })).toEqual([]);
    expect(availableGhlSendChannels(null)).toEqual([]);
    expect(availableGhlSendChannels(undefined)).toEqual([]);
  });
});
