import { FormEvent, useState } from "react";
import { Loader2, Send, TerminalSquare } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Entry = {
  command: string;
  ok: boolean;
  message: string;
  action?: string;
};

const EXAMPLES = [
  "create customer named API Test Customer",
  "clock me into Smith driveway",
  "clock me out of Smith driveway",
  "create estimate for Mike Weiss for $8200 concrete sidewalk",
  "create invoice for Mike Weiss for $1200 concrete repair",
  "text Mike Weiss: Your estimate is ready.",
];

export default function GhlCommandCenter() {
  const { activeOrg } = useAuth();
  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<Entry[]>([]);

  const run = async (raw?: string) => {
    const value = (raw ?? command).trim();
    if (!value || running) return;
    if (!activeOrg?.organization_id) {
      toast.error("No active organization");
      return;
    }

    setRunning(true);
    if (!raw) setCommand("");
    try {
      const { data, error } = await supabase.functions.invoke("ghl-command", {
        body: { organizationId: activeOrg.organization_id, command: value },
      });

      if (error) {
        let message = error.message || "Command failed";
        const context = (error as any).context;
        if (context instanceof Response) {
          try {
            const body = await context.clone().json();
            message = body?.error || message;
          } catch {}
        }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);

      const message = data?.message || "Done.";
      setHistory((h) => [{ command: value, ok: true, message, action: data?.action }, ...h]);
      toast.success(message);
    } catch (e: any) {
      const message = e?.message || "Command failed";
      setHistory((h) => [{ command: value, ok: false, message }, ...h]);
      toast.error(message);
    } finally {
      setRunning(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="FastTract Command Center"
        description="Run everyday business actions in plain English — customers, time clock, estimates, invoices, and messages."
      />

      <Card className="p-4 md:p-6">
        <div className="mb-4 flex items-center gap-2">
          <TerminalSquare className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">FastTract Actions</p>
            <p className="text-sm text-muted-foreground">Securely connected to your business account.</p>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Example: create customer named API Test Customer"
            disabled={running}
            className="h-12 flex-1"
            autoFocus
          />
          <Button type="submit" disabled={running || !command.trim()} className="h-12 px-6">
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Run
          </Button>
        </form>

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Try one</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                disabled={running}
                onClick={() => void run(example)}
                className="rounded-full border border-border px-3 py-1.5 text-left text-xs text-muted-foreground transition hover:border-primary hover:text-foreground disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Recent commands</h2>
          <Badge variant="outline">This session</Badge>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Run a command above. The result will show here.</p>
        ) : (
          <div className="space-y-3">
            {history.map((item, index) => (
              <div key={`${item.command}-${index}`} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={item.ok ? "secondary" : "destructive"}>{item.ok ? "Completed" : "Failed"}</Badge>
                  {item.action && <span className="text-xs text-muted-foreground">{item.action}</span>}
                </div>
                <p className="mt-2 text-sm font-medium">{item.command}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
