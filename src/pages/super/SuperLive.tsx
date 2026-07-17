import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Radio } from "lucide-react";

export default function SuperLive() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("ai_usage")
      .select("created_at,function_name,model,estimated_cost_usd,organization_id")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setEvents(data ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-primary/80">Telemetry</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Live Signals</h1>
        </div>
        <Radio className="h-5 w-5 animate-pulse text-primary" />
      </header>
      <Card className="border-border/60 bg-card/70">
        <div className="divide-y divide-border/60 font-mono text-xs">
          {events.map((e, i) => (
            <div key={i} className="grid grid-cols-[130px_1fr_100px_80px] items-center gap-3 px-4 py-2">
              <span className="text-foreground/50">{new Date(e.created_at).toLocaleTimeString()}</span>
              <span className="truncate text-primary">{e.function_name}</span>
              <span className="truncate text-foreground/70">{e.model}</span>
              <span className="text-right tabular-nums">${Number(e.estimated_cost_usd ?? 0).toFixed(4)}</span>
            </div>
          ))}
          {events.length === 0 && (
            <div className="p-8 text-center text-sm text-foreground/50 font-sans">No recent AI activity.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
