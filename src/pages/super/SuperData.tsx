import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Database } from "lucide-react";

const TABLES = [
  "organizations",
  "organization_members",
  "profiles",
  "leads",
  "customers",
  "estimates",
  "invoices",
  "jobs",
  "time_entries",
  "subscriptions",
  "ai_usage",
];

export default function SuperData() {
  const [counts, setCounts] = useState<Record<string, number | null>>({});

  useEffect(() => {
    (async () => {
      const results: Record<string, number | null> = {};
      await Promise.all(
        TABLES.map(async (t) => {
          const { count, error } = await supabase.from(t as any).select("*", { count: "exact", head: true });
          results[t] = error ? null : count ?? 0;
        }),
      );
      setCounts(results);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs uppercase tracking-[0.25em] text-primary/80">Warehouse</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Data Console</h1>
        <p className="mt-1 text-sm text-foreground/60">Row counts across core tables. Read-only snapshot.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TABLES.map((t) => (
          <Card key={t} className="flex items-center justify-between border-border/60 bg-card/70 p-4">
            <div className="flex items-center gap-3">
              <Database className="h-4 w-4 text-primary" />
              <span className="font-mono text-sm">{t}</span>
            </div>
            <span className="text-lg font-semibold tabular-nums">
              {counts[t] === undefined ? "…" : counts[t] === null ? "—" : counts[t]}
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
}
