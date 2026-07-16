import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, DollarSign, Activity } from "lucide-react";

type Row = {
  organization_id: string | null;
  user_id: string | null;
  function_name: string;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  created_at: string;
};

const RANGES = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 } as const;
type Range = keyof typeof RANGES;

export default function AdminAiUsage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [orgs, setOrgs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("30d");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - RANGES[range] * 86400_000).toISOString();
      const { data } = await supabase
        .from("ai_usage")
        .select("organization_id,user_id,function_name,model,prompt_tokens,completion_tokens,total_tokens,estimated_cost_usd,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      const list = (data ?? []) as Row[];
      setRows(list);

      const orgIds = Array.from(new Set(list.map((r) => r.organization_id).filter(Boolean))) as string[];
      if (orgIds.length) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("id,name")
          .in("id", orgIds);
        const map: Record<string, string> = {};
        (orgData ?? []).forEach((o: any) => (map[o.id] = o.name));
        setOrgs(map);
      } else {
        setOrgs({});
      }
      setLoading(false);
    })();
  }, [range]);

  const totalCost = rows.reduce((s, r) => s + Number(r.estimated_cost_usd || 0), 0);
  const totalCalls = rows.length;
  const totalTokens = rows.reduce((s, r) => s + (r.total_tokens || 0), 0);

  // Aggregate by org
  const byOrg = new Map<string, { calls: number; tokens: number; cost: number }>();
  for (const r of rows) {
    const k = r.organization_id ?? "unknown";
    const cur = byOrg.get(k) ?? { calls: 0, tokens: 0, cost: 0 };
    cur.calls += 1;
    cur.tokens += r.total_tokens || 0;
    cur.cost += Number(r.estimated_cost_usd || 0);
    byOrg.set(k, cur);
  }
  const orgRows = Array.from(byOrg.entries())
    .map(([id, v]) => ({ id, name: orgs[id] ?? (id === "unknown" ? "(unknown)" : id.slice(0, 8)), ...v }))
    .sort((a, b) => b.cost - a.cost);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI Usage</h1>
          <p className="text-sm text-muted-foreground">
            Per-organization AI spend across the assistant, form helper, transcription, and TTS.
          </p>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as Range)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Estimated cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-semibold">${totalCost.toFixed(2)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total calls</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-semibold">{totalCalls.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total tokens</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-semibold">{totalTokens.toLocaleString()}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>By organization</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : orgRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No AI usage in this range.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Est. cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.id !== "unknown" ? (
                        <Link to={`/admin/organizations/${r.id}`} className="hover:underline">{r.name}</Link>
                      ) : r.name}
                    </TableCell>
                    <TableCell className="text-right">{r.calls.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{r.tokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right">${r.cost.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent calls</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Org</TableHead>
                <TableHead>Function</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 100).map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.organization_id ? (orgs[r.organization_id] ?? r.organization_id.slice(0, 8)) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{r.function_name}</TableCell>
                  <TableCell className="text-xs">{r.model ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs">{r.total_tokens.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-xs">${Number(r.estimated_cost_usd).toFixed(4)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
