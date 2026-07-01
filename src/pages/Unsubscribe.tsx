import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "invalid" | "already" | "success" | "error";

export default function Unsubscribe() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";
  const [state, setState] = useState<State>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setState("invalid"); return; }
        if (data.used_at || data.already_unsubscribed) { setState("already"); setEmail(data.email ?? null); return; }
        setState("valid"); setEmail(data.email ?? null);
      } catch (e) { setErr((e as Error).message); setState("error"); }
    })();
  }, [token]);

  const confirm = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j?.error || "Failed"); setState("error"); return; }
      setState("success");
    } catch (e) { setErr((e as Error).message); setState("error"); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Email preferences</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && <p className="text-sm text-muted-foreground">Checking your link…</p>}
          {state === "invalid" && <p className="text-sm">This unsubscribe link is invalid or expired.</p>}
          {state === "already" && <p className="text-sm">{email ?? "This address"} is already unsubscribed.</p>}
          {state === "valid" && (
            <>
              <p className="text-sm">Unsubscribe {email ?? "this address"} from future emails?</p>
              <Button onClick={confirm}>Confirm unsubscribe</Button>
            </>
          )}
          {state === "success" && <p className="text-sm">You've been unsubscribed. You won't receive further emails.</p>}
          {state === "error" && <p className="text-sm text-destructive">{err || "Something went wrong."}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
