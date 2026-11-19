import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { resolvePostLoginRoute } from "@/lib/post-login-route";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

type JoinStatus = "idle" | "joining" | "error";

export default function JoinTeam() {
  const [params] = useSearchParams();
  const inviteToken = params.get("invite")?.trim() || "";
  const validToken = /^[a-f0-9]{64}$/i.test(inviteToken);
  const joinPath = `/join?invite=${encodeURIComponent(inviteToken)}`;
  const loginPath = `/login?next=${encodeURIComponent(joinPath)}`;
  const signupPath = `/signup?invite=${encodeURIComponent(inviteToken)}`;
  const navigate = useNavigate();
  const { user, loading, memberships, isPlatformAdmin, isAgent, refresh, setActiveOrgId, signOut } = useAuth();
  const attempted = useRef<string | null>(null);
  const [status, setStatus] = useState<JoinStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (loading || !user || !validToken) return;
    const attemptId = `${user.id}:${inviteToken}`;
    if (attempted.current === attemptId) return;
    attempted.current = attemptId;
    setStatus("joining");

    void (async () => {
      // The server validates the token, the invited email, and the pending state.
      // A join link never grants permission to create a new organization.
      const { data: orgId, error } = await supabase.rpc("accept_invitation", {
        invite_token: inviteToken,
      });
      if (error || !orgId) {
        setErrorMessage(
          "This invitation could not be accepted. Sign in with the exact email address your employer invited, or ask your manager for a fresh link.",
        );
        setStatus("error");
        return;
      }

      setActiveOrgId(orgId);
      await refresh();
      const { data: member, error: memberError } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", orgId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberError || !member) {
        setErrorMessage("Your invitation was accepted, but we couldn't load your access. Please sign in again.");
        setStatus("error");
        return;
      }

      navigate(member.role === "worker" ? "/field" : "/app", { replace: true });
    })();
  }, [loading, user, validToken, inviteToken, refresh, setActiveOrgId, navigate]);

  const dashboard = resolvePostLoginRoute({ memberships, isPlatformAdmin, isAgent });

  return (
    <main className="min-h-screen bg-gradient-dark">
      <header className="mx-auto max-w-7xl px-4 py-5"><Logo /></header>
      <section className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-8 shadow-card">
          <h1 className="text-2xl font-semibold">Join your company's team</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your employer has invited you to FastTract. You only need an employee login to see assigned jobs and clock in. Do not set up a new company.
          </p>

          {!validToken ? (
            <p className="mt-6 text-sm text-destructive">This invitation link is missing or incomplete. Ask your employer to send another one.</p>
          ) : loading || (user && status !== "error") ? (
            <p role="status" className="mt-6 text-sm text-muted-foreground">
              {loading ? "Loading your account…" : "Connecting you to your employer…"}
            </p>
          ) : !user ? (
            <div className="mt-6 grid gap-3">
              <Button asChild><Link to={signupPath}>Create employee login</Link></Button>
              <Button asChild variant="outline"><Link to={loginPath}>I already have an account</Link></Button>
              <p className="text-xs text-muted-foreground">Use the same email address your employer invited.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <p role="alert" className="text-sm text-destructive">{errorMessage}</p>
              <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  await signOut();
                  navigate(loginPath, { replace: true });
                }}
              >
                Switch account
              </Button>
              {memberships.length > 0 && (
                <Button asChild className="w-full"><Link to={dashboard}>Go to my existing workspace</Link></Button>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
