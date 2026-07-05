import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { SEO } from "@/components/SEO";

// Narrow local typing for the beta supabase.auth.oauth namespace.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  if (error)
    return (
      <div className="min-h-screen bg-gradient-dark p-6 text-foreground">
        <SEO title="Authorization error — FastTract" path="/.lovable/oauth/consent" noindex />
        <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-card p-8">
          <Logo />
          <h1 className="mt-6 text-xl font-semibold">Could not load this authorization request</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  if (!details)
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-dark text-muted-foreground">
        Loading authorization…
      </div>
    );

  const clientName = details.client?.name ?? "an app";
  return (
    <div className="min-h-screen bg-gradient-dark p-6 text-foreground">
      <SEO title="Approve access — FastTract" path="/.lovable/oauth/consent" noindex />
      <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-card p-8">
        <Logo />
        <h1 className="mt-6 text-xl font-semibold">Connect {clientName} to your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {clientName} will be able to read and modify your FastTract data as you, using the tools this app exposes.
        </p>
        {details.client?.uri && (
          <p className="mt-2 break-all text-xs text-muted-foreground">{details.client.uri}</p>
        )}
        <div className="mt-6 flex gap-3">
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            Approve
          </Button>
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
            Deny
          </Button>
        </div>
      </div>
    </div>
  );
}
