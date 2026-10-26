import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function Account() {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requested, setRequested] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.rpc("get_account_deletion_request").then(({ data, error }) => {
      if (!active) return;
      setLoadError(Boolean(error));
      setRequested(Boolean(data?.length));
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function requestDeletion() {
    if (!confirmed || busy || loading || loadError) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("request_account_deletion");
      if (error) throw error;
      setRequested(true);
      toast.success("Account deletion requested");
    } catch {
      toast.error("Your request was not saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
    <h1 className="text-2xl font-semibold">Account & privacy</h1>
    <nav className="flex gap-4 text-sm"><Link to="/login" className="underline">Back to FastTract</Link><Link to="/privacy" className="underline">Privacy policy</Link></nav>
    <Card className="space-y-4 p-6">
      <h2 className="text-lg font-semibold">Delete your account</h2>
      <p>Request permanent deletion of your FastTract account and personal data here. You do not need to call or email to submit this request.</p>
      <p className="text-sm text-muted-foreground">Deletion is processed within 30 days. Personal data required by law may be retained. If you own a company, we will arrange ownership or company closure before removing your account. Deletion does not cancel an existing subscription; manage it through your original billing provider.</p>
      {loading ? <p role="status">Checking request status…</p> : loadError ? <p role="alert">Request status is unavailable. Please reload and try again.</p> : requested ? <p role="status">Your deletion request is recorded. Processing may take up to 30 days. We will notify your account email when it is complete or if ownership information is needed.</p> : <>
        <label className="flex items-start gap-3 text-sm"><Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} disabled={busy} /><span>I understand that completed deletion is permanent and want my account deleted.</span></label>
        <Button variant="destructive" disabled={!confirmed || busy} onClick={() => void requestDeletion()}>{busy ? "Saving request…" : "Request permanent account deletion"}</Button>
      </>}
    </Card>
  </main>;
}
