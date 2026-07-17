import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { KeyRound, Mail, Sparkles, Ban } from "lucide-react";

async function callAdmin(action: any) {
  const { data, error } = await supabase.functions.invoke("admin-support", { body: action });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export default function SuperControls() {
  const [resetEmail, setResetEmail] = useState("");
  const [pwEmail, setPwEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [orgId, setOrgId] = useState("");
  const [tier, setTier] = useState<"base" | "plus" | "premium">("plus");
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs uppercase tracking-[0.25em] text-primary/80">Root actions</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Control Panel</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Privileged operations run through the admin-support function with your platform_admin role verified server-side.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/70 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <h3 className="font-medium">Send password reset</h3>
          </div>
          <div className="space-y-3">
            <div>
              <Label>User email</Label>
              <Input value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <Button
              disabled={!resetEmail || busy === "reset"}
              onClick={() =>
                run("reset", () => callAdmin({ type: "send_password_reset", email: resetEmail }), "Reset email sent")
              }
            >
              {busy === "reset" ? "Sending…" : "Send reset"}
            </Button>
          </div>
        </Card>

        <Card className="border-border/60 bg-card/70 p-5">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h3 className="font-medium">Set user password</h3>
          </div>
          <div className="space-y-3">
            <div>
              <Label>User email</Label>
              <Input value={pwEmail} onChange={(e) => setPwEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div>
              <Label>New password (min 8)</Label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <Button
              disabled={!pwEmail || newPw.length < 8 || busy === "pw"}
              onClick={() =>
                run("pw", () => callAdmin({ type: "set_user_password", email: pwEmail, password: newPw }), "Password updated")
              }
            >
              {busy === "pw" ? "Saving…" : "Set password"}
            </Button>
          </div>
        </Card>

        <Card className="border-border/60 bg-card/70 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-medium">Comp / assign plan</h3>
          </div>
          <div className="space-y-3">
            <div>
              <Label>Organization ID</Label>
              <Input value={orgId} onChange={(e) => setOrgId(e.target.value)} placeholder="uuid…" />
            </div>
            <div>
              <Label>Tier</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">Base ($69)</SelectItem>
                  <SelectItem value="plus">Plus ($169)</SelectItem>
                  <SelectItem value="premium">Premium ($269)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={!orgId || busy === "plan"}
                onClick={() =>
                  run("plan", () => callAdmin({ type: "set_plan", organization_id: orgId, tier, days: null }), "Plan assigned")
                }
              >
                {busy === "plan" ? "Applying…" : "Comp indefinitely"}
              </Button>
              <Button
                variant="secondary"
                disabled={!orgId || busy === "remove"}
                onClick={() =>
                  run("remove", () => callAdmin({ type: "remove_comp", organization_id: orgId }), "Comp removed")
                }
              >
                Remove comp
              </Button>
            </div>
          </div>
        </Card>

        <Card className="border-destructive/40 bg-destructive/5 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Ban className="h-4 w-4 text-destructive" />
            <h3 className="font-medium">Danger zone</h3>
          </div>
          <p className="text-sm text-foreground/60">
            Deleting organizations and refunding transactions is available in the org detail page. Open an org from
            the Organizations list to access destructive actions with audit trail.
          </p>
        </Card>
      </div>
    </div>
  );
}
