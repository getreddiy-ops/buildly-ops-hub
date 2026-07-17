import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function SuperOrgs() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("organizations").select("id,name,slug,created_at").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setRows(data ?? []));
  }, []);

  const filtered = rows.filter((r) => r.name?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs uppercase tracking-[0.25em] text-primary/80">Directory</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Organizations</h1>
      </header>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organizations…" className="pl-9" />
      </div>
      <Card className="border-border/60 bg-card/70">
        <div className="divide-y divide-border/60">
          {filtered.map((o) => (
            <Link
              key={o.id}
              to={`/admin/organizations/${o.id}`}
              className="flex items-center justify-between px-5 py-3 text-sm hover:bg-secondary/40"
            >
              <div>
                <div className="font-medium">{o.name}</div>
                <div className="text-xs text-foreground/50">{o.slug ?? o.id}</div>
              </div>
              <div className="text-xs text-foreground/50">{new Date(o.created_at).toLocaleDateString()}</div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-foreground/50">No organizations match.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
