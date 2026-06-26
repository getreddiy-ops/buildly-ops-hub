import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AiField = {
  name: string;
  type?: "string" | "number" | "boolean" | "date" | "email" | "phone";
  description?: string;
  enum?: string[];
};

interface Props<T extends Record<string, any>> {
  formName: string;
  fields: AiField[];
  onFill: (values: Partial<T>) => void;
  placeholder?: string;
  context?: Record<string, unknown>;
  size?: "sm" | "default";
}

export function AiFormHelper<T extends Record<string, any>>({
  formName,
  fields,
  onFill,
  placeholder,
  context,
  size = "sm",
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const text = prompt.trim();
    if (!text) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-form-fill", {
        body: { prompt: text, formName, fields, context },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const values = (data?.values ?? {}) as Partial<T>;
      if (!Object.keys(values).length) {
        toast.message("AI could not extract any fields from that. Try adding more detail.");
        return;
      }
      onFill(values);
      toast.success(`Filled ${Object.keys(values).length} field${Object.keys(values).length > 1 ? "s" : ""}`);
      setOpen(false);
      setPrompt("");
    } catch (e: any) {
      toast.error(e?.message ?? "AI fill failed");
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
          Fill with AI
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] space-y-2">
        <p className="text-xs text-muted-foreground">
          Describe what you want. AI will fill the fields it can — you'll still review before saving.
        </p>
        <Textarea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder ?? "e.g. New customer Sarah Lee, 555-0142, 12 Oak St, kitchen remodel referral"}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
          }}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={run} disabled={loading || !prompt.trim()}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Fill
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
