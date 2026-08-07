import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";

type Health = {
  last_event_at: string | null;
  last_event_type: string | null;
  events_24h: number;
  events_7d: number;
  events_total: number;
};

type Status = "healthy" | "quiet" | "stale" | "never" | "unknown";

const STATUS_META: Record<Status, { label: string; className: string; hint: string }> = {
  healthy: {
    label: "Receiving events",
    className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-500",
    hint: "Stripe delivered webhook events in the last 24 hours.",
  },
  quiet: {
    label: "Quiet",
    className: "border-amber-500/40 bg-amber-500/15 text-amber-500",
    hint: "No events in 24 hours, but activity within the last 7 days. Normal on low-volume days.",
  },
  stale: {
    label: "Stale — check endpoint",
    className: "border-rose-500/40 bg-rose-500/15 text-rose-500",
    hint: "No webhook events for over 7 days. Verify the Stripe endpoint is still enabled and pointing at the stripe-webhook function.",
  },
  never: {
    label: "Never received",
    className: "border-rose-500/40 bg-rose-500/15 text-rose-500",
    hint: "No webhook event has ever been processed. In Stripe → Developers → Webhooks, confirm an enabled endpoint pointing at this project's stripe-webhook function, subscribed to checkout.session.completed, customer.subscription.*, and invoice.* events, and that its signing secret matches STRIPE_WEBHOOK_SECRET.",
  },
  unknown: {
    label: "Unavailable",
    className: "border-border bg-muted text-muted-foreground",
    hint: "Webhook status could not be read.",
  },
};

function deriveStatus(h: Health | null): Status {
  if (!h) return "unknown";
  if (!h.last_event_at) return "never";
  if (h.events_24h > 0) return "healthy";
  if (h.events_7d > 0) return "quiet";
  return "stale";
}

function relative(iso: string | null) {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

/** Read-only Stripe webhook delivery health. Platform admins only; exposes no secrets. */
export function StripeWebhookHealth({ className }: { className?: string }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("get_stripe_webhook_health");
    if (error) {
      setError(error.message);
      setHealth(null);
    } else {
      const row = (Array.isArray(data) ? data[0] : data) as Health | undefined;
      setHealth(row ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const status = error ? "unknown" : deriveStatus(health);
  const meta = STATUS_META[status];

  return (
    <Card className={cn("border-border/60 bg-card/70 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Webhook className="h-4 w-4 text-primary" />
          <div className="text-sm font-medium">Stripe webhook</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("text-[10px]", meta.className)}>
            {loading ? "Checking…" : meta.label}
          </Badge>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={load} disabled={loading} aria-label="Refresh webhook status">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        {[
          { label: "24h", value: health?.events_24h ?? 0 },
          { label: "7d", value: health?.events_7d ?? 0 },
          { label: "Total", value: health?.events_total ?? 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border/50 bg-background/40 py-2">
            <div className="text-lg font-semibold">{loading || error ? "—" : s.value}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <dl className="mt-4 space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between gap-3">
          <dt>Last event</dt>
          <dd className="truncate text-foreground/80">{loading || error ? "—" : relative(health?.last_event_at ?? null)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Type</dt>
          <dd className="truncate text-foreground/80">{loading || error ? "—" : health?.last_event_type ?? "—"}</dd>
        </div>
      </dl>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{error ?? meta.hint}</p>
    </Card>
  );
}

export default StripeWebhookHealth;
