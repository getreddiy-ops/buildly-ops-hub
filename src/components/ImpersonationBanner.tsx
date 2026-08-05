import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ImpersonationMeta,
  exitImpersonation,
  getImpersonation,
  logImpersonationEvent,
} from "@/lib/impersonation";

/**
 * Shown whenever a platform admin is working inside a customer account.
 * Also records every page the admin visits during the session.
 */
export function ImpersonationBanner() {
  const [meta, setMeta] = useState<ImpersonationMeta | null>(null);
  const [leaving, setLeaving] = useState(false);
  const location = useLocation();
  const lastPath = useRef<string>("");

  useEffect(() => {
    setMeta(getImpersonation());
  }, [location.pathname]);

  useEffect(() => {
    if (!meta) return;
    const path = location.pathname + location.search;
    if (lastPath.current === path) return;
    lastPath.current = path;
    void logImpersonationEvent({ action: "page_view", path });
  }, [meta, location.pathname, location.search]);

  // Record form submissions and button presses inside the customer account.
  useEffect(() => {
    if (!meta) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest("button, a[href]");
      if (!el) return;
      const label = (el.textContent ?? "").trim().slice(0, 80);
      if (!label) return;
      void logImpersonationEvent({
        action: "click",
        path: location.pathname,
        details: { label, tag: el.tagName.toLowerCase() },
      });
    };
    const onSubmit = () =>
      void logImpersonationEvent({ action: "form_submit", path: location.pathname });
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [meta, location.pathname]);

  if (!meta) return null;

  return (
    <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-between gap-2 border-b border-destructive/40 bg-destructive px-4 py-2 text-destructive-foreground">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span className="truncate">
          Support workspace — you are signed in as{" "}
          <strong className="font-semibold">{meta.target_email}</strong>
          {meta.organization_name ? ` (${meta.organization_name})` : ""}. All actions are logged.
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={leaving}
        onClick={async () => {
          setLeaving(true);
          await exitImpersonation();
        }}
      >
        <LogOut className="mr-2 h-4 w-4" />
        {leaving ? "Exiting…" : "Exit workspace"}
      </Button>
    </div>
  );
}
