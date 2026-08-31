import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Mic,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useHighLevel } from "@/contexts/HighLevelContext";
import { useBrowserSpeech } from "@/hooks/useBrowserSpeech";
import { highLevel } from "@/integrations/highlevel/client";
import { toast } from "sonner";

type AvaResult = {
  intent?: "create_estimate" | "review_leads" | "create_job" | "review_money" | "find_customer" | "other";
  summary?: string;
  next_step?: string;
  route?: "/highlevel/estimates" | "/highlevel/leads" | "/highlevel/jobs" | "/highlevel/money" | "/highlevel/customers" | "/highlevel/home";
  requires_approval?: boolean;
};

const suggestions = [
  "Build an estimate for a 30 by 20 stamped concrete patio with removal",
  "Show me the leads that still need a callback",
  "Create a job for the Fletcher driveway next Monday",
  "What estimate money is still waiting on customers?",
];

export default function HighLevelAssistant() {
  const { firstName, connection } = useHighLevel();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [prompt, setPrompt] = useState(searchParams.get("prompt") ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AvaResult | null>(null);
  const voice = useBrowserSpeech((transcript) => {
    setPrompt((current) => [current.trim(), transcript].filter(Boolean).join(" "));
  });

  useEffect(() => {
    const incoming = searchParams.get("prompt");
    if (incoming) setPrompt(incoming);
  }, [searchParams]);

  const actionRoute = useMemo(() => {
    if (!result?.route) return null;
    if (result.route === "/highlevel/estimates" && prompt.trim()) {
      return `${result.route}?prompt=${encodeURIComponent(prompt.trim())}`;
    }
    return result.route;
  }, [prompt, result]);

  const run = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = prompt.trim();
    if (!text) return;

    setLoading(true);
    setResult(null);
    try {
      const response = await highLevel.aiFormFill<AvaResult>({
        prompt: text,
        formName: "FastTract Ava request router",
        fields: [
          {
            name: "intent",
            enum: ["create_estimate", "review_leads", "create_job", "review_money", "find_customer", "other"],
            description: "The user's primary contractor-business intent",
          },
          { name: "summary", description: "A short plain-language restatement of what Ava understood" },
          { name: "next_step", description: "The specific next step FastTract should take" },
          {
            name: "route",
            enum: ["/highlevel/estimates", "/highlevel/leads", "/highlevel/jobs", "/highlevel/money", "/highlevel/customers", "/highlevel/home"],
            description: "The FastTract screen that should handle the request",
          },
          { name: "requires_approval", type: "boolean", description: "True when the request would create, change, send, or delete business data" },
        ],
        context: {
          locationId: connection?.locationId,
          instruction: "Use plain contractor language. Never claim an action was completed. Route the user to the correct FastTract workspace for review.",
        },
      });

      setResult(response.values);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ava could not process that request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto min-w-0 max-w-5xl px-4 py-7 sm:px-7 lg:px-9">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto h-20 w-20 overflow-hidden rounded-2xl border border-primary/30 bg-primary/10 shadow-elevated">
          <img
            src="/ava-onboarding.png"
            alt="Ava, the FastTract assistant"
            className="h-full w-full object-cover object-[center_24%]"
          />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Ava · FastTract AI</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">What should we handle, {firstName}?</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Describe the work the same way you would explain it to someone on your crew. Ava will organize it and take you to the right FastTract workspace.
        </p>
      </div>

      <form onSubmit={(event) => void run(event)} className="mx-auto mt-8 max-w-3xl rounded-2xl border border-primary/25 bg-card p-3 shadow-elevated">
        <Textarea
          rows={7}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Example: Build a customer-facing estimate for a 30 x 20 stamped patio. Remove the existing slab, add four inches of compacted rock, use rebar, include two steps and a concrete pump."
          className="resize-none border-0 bg-transparent text-base leading-7 shadow-none focus-visible:ring-0"
          autoFocus
        />
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-3">
          <p className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><ShieldCheck className="h-4 w-4 text-primary" /> You review changes before FastTract saves or sends them.</p>
          <div className="ml-auto flex gap-2">
            <Button type="button" size="icon" variant="ghost" aria-label={voice.listening ? "Stop voice input" : "Speak to Ava"} onClick={voice.listening ? voice.stop : voice.start}><Mic className={voice.listening ? "h-5 w-5 animate-pulse text-primary" : "h-5 w-5"} /></Button>
            <Button type="submit" disabled={loading || !prompt.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {loading ? "Understanding…" : "Continue"}
            </Button>
          </div>
        </div>
      </form>

      {!result && (
        <div className="mx-auto mt-6 grid max-w-3xl gap-2 sm:grid-cols-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setPrompt(suggestion)}
              className="flex items-start gap-3 rounded-xl border border-border bg-card/40 p-4 text-left text-sm transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-primary/25 bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CheckCircle2 className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Ava understood</p>
              <h2 className="mt-2 text-xl font-semibold">{result.summary || "Your request is ready for the next step."}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.next_step || "Open the recommended FastTract workspace to continue."}</p>
              {result.requires_approval && (
                <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  This request can change business data. FastTract will show the draft and require your approval before saving or sending it.
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {actionRoute && (
                  <Button onClick={() => navigate(actionRoute)}>
                    {result.intent === "create_estimate" && <FileText className="h-4 w-4" />}
                    Open workspace <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" onClick={() => setResult(null)}>Change request</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
