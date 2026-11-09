import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAiConnection } from "@/hooks/useAiConnection";
import { readFunctionError } from "@/lib/function-error";
import { DEFAULT_MODELS, PROVIDER_LABELS, type AiProvider } from "../../../supabase/functions/_shared/ai-translate";

const KEY_HELP: Record<AiProvider, { url: string; label: string }> = {
  openai: { url: "https://platform.openai.com/api-keys", label: "platform.openai.com → API keys" },
  anthropic: { url: "https://console.anthropic.com/settings/keys", label: "console.anthropic.com → API keys" },
  google: { url: "https://aistudio.google.com/apikey", label: "aistudio.google.com → Get API key" },
};

/** Settings → AI: connect the business's own AI provider. The key is checked, stored in Vault, never shown again. */
export function AiConnectionCard() {
  const { activeOrg } = useAuth();
  const canManage = activeOrg?.role === "owner" || activeOrg?.role === "admin";
  const { connection, loading, refetch, orgId } = useAiConnection();
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<null | "connect" | "test" | "disconnect">(null);
  const [editing, setEditing] = useState(false);

  const call = async (kind: "connect" | "test" | "disconnect", body: Record<string, unknown>, ok: string) => {
    if (!orgId) return;
    setBusy(kind);
    try {
      const { data, error } = await supabase.functions.invoke("connect-ai", { body: { organizationId: orgId, ...body } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(ok);
      setApiKey("");
      setEditing(false);
      await refetch();
    } catch (e) {
      toast.error((await readFunctionError(e, "Could not update the AI connection")).message);
    } finally {
      setBusy(null);
    }
  };

  const showForm = canManage && (!connection || editing);

  return (
    <Card id="ai">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>AI provider</CardTitle>
              <CardDescription>FastTract's AI features run on your own AI account, so you choose the provider and pay it directly. Everything else in FastTract works without it.</CardDescription>
            </div>
          </div>
          {!loading && <Badge variant={connection?.status === "connected" ? "default" : "secondary"}>
            {!connection ? "Not connected" : connection.status === "connected" ? "Connected" : "Needs attention"}
          </Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection && !editing && <div className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Provider:</span> {PROVIDER_LABELS[connection.provider]} · <span className="text-muted-foreground">Model:</span> {connection.model} · <span className="text-muted-foreground">Key:</span> ••••{connection.key_last4}</p>
          {connection.status === "failing" && connection.last_error && <p className="text-destructive">{connection.last_error}</p>}
        </div>}

        {connection && !editing && canManage && <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy !== null} onClick={() => call("test", { action: "test" }, "Your AI provider answered.")}>
            {busy === "test" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Test connection
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => { setProvider(connection.provider); setModel(connection.model); setEditing(true); }}>Replace key</Button>
          <Button variant="ghost" disabled={busy !== null} onClick={() => confirm("Disconnect your AI provider? AI features will stop until you connect one again.") && call("disconnect", { action: "disconnect" }, "AI provider disconnected.")}>
            {busy === "disconnect" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Disconnect
          </Button>
        </div>}

        {!canManage && !connection && !loading && <p className="text-sm text-muted-foreground">Ask the business owner or an admin to connect an AI provider.</p>}

        {showForm && <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void call("connect", { provider, model: model.trim() || undefined, apiKey }, "AI provider connected."); }}>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Provider</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((p) => <Button key={p} type="button" variant={provider === p ? "default" : "outline"} aria-pressed={provider === p} onClick={() => setProvider(p)}>{PROVIDER_LABELS[p]}</Button>)}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-key">API key</Label>
              <Input id="ai-key" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your key" required />
              <p className="text-xs text-muted-foreground">Get one at <a className="underline" href={KEY_HELP[provider].url} target="_blank" rel="noreferrer">{KEY_HELP[provider].label}</a>. It's checked, stored encrypted, and never shown again.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-model">Model (optional)</Label>
              <Input id="ai-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder={DEFAULT_MODELS[provider]} />
              <p className="text-xs text-muted-foreground">Leave blank for {DEFAULT_MODELS[provider]}. Photo estimates need a model that can read images.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy !== null || !apiKey.trim()}>
              {busy === "connect" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Check and connect
            </Button>
            {editing && <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
          </div>
        </form>}
      </CardContent>
    </Card>
  );
}
