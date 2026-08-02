import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Phone, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

/**
 * Dashboard entry point for the AI phone assistant. Visible to Premium orgs and
 * platform admins so first-run setup is discoverable outside the nav menu.
 */
export function PhoneAssistantStatusCard() {
  const { activeOrg, isPlatformAdmin } = useAuth();
  const { canUsePhoneAssistant } = useSubscription();
  const orgId = activeOrg?.organization_id ?? null;
  const [state, setState] = useState<{ agent: boolean; number: string | null } | null>(null);

  const visible = canUsePhoneAssistant || isPlatformAdmin;

  useEffect(() => {
    if (!orgId || !visible) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("phone_assistants")
        .select("elevenlabs_agent_id, twilio_phone_number")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!cancelled) {
        setState({
          agent: !!data?.elevenlabs_agent_id,
          number: (data?.twilio_phone_number as string | null) ?? null,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [orgId, visible]);

  if (!visible) return null;

  const ready = !!state?.agent && !!state?.number;
  const headline = !state
    ? "Checking your AI phone assistant…"
    : ready
      ? `Answering calls at ${state.number}`
      : state.agent
        ? "Assistant created — connect a phone number"
        : "Set up your AI phone assistant";

  return (
    <Link
      to="/app/phone-assistant"
      className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25">
        {ready ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Phone className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          AI Phone Assistant
        </span>
        <strong className="mt-1 block truncate text-sm font-semibold">{headline}</strong>
        <small className="block text-muted-foreground">
          {ready ? "Every call is transcribed and summarized." : "Create the assistant, then connect a number."}
        </small>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
