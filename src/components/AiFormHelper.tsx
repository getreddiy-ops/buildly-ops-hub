import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { highLevel, isEmbeddedHighLevel, type HighLevelAiField } from "@/integrations/highlevel/client";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AiField = HighLevelAiField;

interface Props<T extends Record<string, any>> {
  formName: string;
  fields: AiField[];
  onFill: (values: Partial<T>) => void;
  placeholder?: string;
  context?: Record<string, unknown>;
  size?: "sm" | "default";
  initialPrompt?: string;
  autoOpen?: boolean;
}

function promptFromLocation() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("prompt") ?? "";
}

export function AiFormHelper<T extends Record<string, any>>({
  formName,
  fields,
  onFill,
  placeholder,
  context,
  size = "sm",
  initialPrompt,
  autoOpen = false,
}: Props<T>) {
  const [open, setOpen] = useState(() => autoOpen && Boolean(initialPrompt ?? promptFromLocation()));
  const [prompt, setPrompt] = useState(() => initialPrompt ?? promptFromLocation());
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const text = prompt.trim();
    if (!text) return;
    setLoading(true);

    try {
      let values: Partial<T> = {};

      if (isEmbeddedHighLevel()) {
        const response = await highLevel.aiFormFill<T>({
          prompt: text,
          formName,
          fields,
          context,
        });
        values = response.values ?? {};
        if (response.warnings?.length) {
          toast.warning("FastTract needs your review", { description: response.warnings.join(" ") });
        }
      } else {
        const { data, error } = await supabase.functions.invoke("ai-form-fill", {
          body: { prompt: text, formName, fields, context },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        values = (data?.values ?? {}) as Partial<T>;
      }

      if (!Object.keys(values).length) {
        toast.message("Ava could not confidently fill any fields. Add a little more detail and try again.");
        return;
      }

      onFill(values);
      toast.success(`Filled ${Object.keys(values).length} field${Object.keys(values).length > 1 ? "s" : ""}`);
      setOpen(false);
      setPrompt("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI fill failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size={size}
          variant="outline"
          className="gap-1.5 border-primary/40 text-primary hover:text-primary"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Fill with Ava
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-2rem))] space-y-2">
        <p className="text-xs leading-5 text-muted-foreground">
          Describe the customer, job, or estimate in plain language. Ava will fill what she can, and you will review everything before saving.
        </p>
        <Textarea
          rows={5}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={placeholder ?? "e.g. New customer Sarah Lee, 555-0142, 12 Oak St, kitchen remodel referral"}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void run();
          }}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={() => void run()} disabled={loading || !prompt.trim()}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {loading ? "Working…" : "Fill"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
