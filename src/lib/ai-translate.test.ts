import { describe, expect, it } from "vitest";
import {
  fromAnthropicResponse,
  fromOpenAiResponse,
  keyLast4,
  looksLikeKey,
  providerEndpoint,
  providerHeaders,
  toAnthropicRequest,
  toOpenAiRequest,
  type ChatRequest,
} from "../../supabase/functions/_shared/ai-translate";

const tool = { type: "function" as const, function: { name: "create_customer", description: "Make a customer", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } };

describe("Anthropic translation", () => {
  it("moves system prompts out, converts images and tools, and forces a named tool", () => {
    const req: ChatRequest = {
      messages: [
        { role: "system", content: "Rules A" },
        { role: "system", content: "Rules B" },
        { role: "user", content: [{ type: "text", text: "Price this" }, { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } }] },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "create_customer" } },
    };
    const body = toAnthropicRequest(req, "claude-sonnet-5-5") as any;
    expect(body.system).toBe("Rules A\n\nRules B");
    expect(body.messages).toEqual([{ role: "user", content: [{ type: "text", text: "Price this" }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "QUJD" } }] }]);
    expect(body.tools[0]).toEqual({ name: "create_customer", description: "Make a customer", input_schema: tool.function.parameters });
    expect(body.tool_choice).toEqual({ type: "tool", name: "create_customer" });
    expect(body.max_tokens).toBe(4096);
  });

  it("turns a tool round-trip into tool_use / tool_result and merges same-role turns", () => {
    const body = toAnthropicRequest({
      messages: [
        { role: "user", content: "Add Sam" },
        { role: "assistant", content: null, tool_calls: [{ id: "t1", type: "function", function: { name: "create_customer", arguments: "{\"name\":\"Sam\"}" } }] },
        { role: "tool", tool_call_id: "t1", content: "created" },
        { role: "user", content: "Thanks" },
      ],
    }, "m") as any;
    expect(body.messages.map((m: any) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(body.messages[1].content[0]).toEqual({ type: "tool_use", id: "t1", name: "create_customer", input: { name: "Sam" } });
    expect(body.messages[2].content).toEqual([{ type: "tool_result", tool_use_id: "t1", content: "created" }, { type: "text", text: "Thanks" }]);
  });

  it("reads text, tool calls and usage back into the shared shape", () => {
    const out = fromAnthropicResponse({ model: "claude-x", content: [{ type: "text", text: "On it. " }, { type: "tool_use", id: "tu1", name: "create_customer", input: { name: "Sam" } }], usage: { input_tokens: 10, output_tokens: 5 } }, "m");
    expect(out).toEqual({ content: "On it. ", tool_calls: [{ id: "tu1", type: "function", function: { name: "create_customer", arguments: "{\"name\":\"Sam\"}" } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }, model: "claude-x" });
  });
});

describe("OpenAI-compatible translation", () => {
  it("passes messages and tools through and reads the first choice", () => {
    const body = toOpenAiRequest({ messages: [{ role: "user", content: "hi" }], tools: [tool] }, "gpt-4o-mini") as any;
    expect(body).toMatchObject({ model: "gpt-4o-mini", tool_choice: "auto" });
    const out = fromOpenAiResponse({ choices: [{ message: { content: "ok", tool_calls: [{ id: "c1", function: { name: "create_customer", arguments: "{}" } }] } }], usage: { prompt_tokens: 3, completion_tokens: 2 } }, "gpt-4o-mini");
    expect(out.content).toBe("ok");
    expect(out.tool_calls[0].function.name).toBe("create_customer");
    expect(out.usage.total_tokens).toBe(5);
  });
});

describe("keys and endpoints", () => {
  it("shows only the last four characters and rejects obvious non-keys", () => {
    expect(keyLast4("  sk-abcdefghijklmnopqrstuvwxyz1234 ")).toBe("1234");
    expect(looksLikeKey("openai", "sk-proj-abcdefghijklmnopqrstu")).toBe(true);
    expect(looksLikeKey("anthropic", "sk-proj-abcdefghijklmnopqrstu")).toBe(false);
    expect(looksLikeKey("openai", "sk- has spaces in it aaaaaaaaaa")).toBe(false);
  });
  it("calls each provider at its own endpoint with its own auth header", () => {
    expect(providerEndpoint("google")).toContain("generativelanguage.googleapis.com/v1beta/openai/");
    expect(providerHeaders("anthropic", "k")).toMatchObject({ "x-api-key": "k", "anthropic-version": "2023-06-01" });
    expect(providerHeaders("openai", "k").Authorization).toBe("Bearer k");
  });
});
