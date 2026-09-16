import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, XCircle, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type LineItem = { description: string; quantity: number; unit_price: number; total: number };
type EstimateView = {
  id: string;
  title: string;
  status: string;
  customerName: string | null;
  companyName: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  brandColor: string | null;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
  depositRequired: number | null;
  depositCollected: boolean;
};

const fmt = (n: number) => Number(n).toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function PublicEstimate() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [estimate, setEstimate] = useState<EstimateView | null>(null);
  const [name, setName] = useState("");
  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("public-estimate", { body: { token, action: "view" } });
    if (error || data?.error) { setNotFound(true); setLoading(false); return; }
    setEstimate(data as EstimateView);
    setLoading(false);
  };

  useEffect(() => { load(); }, [token]);

  const respond = async (action: "accept" | "decline") => {
    if (!token) return;
    if (action === "accept" && !name.trim()) { toast.error("Please type your name to sign"); return; }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("public-estimate", {
      body: { token, action, name: name.trim(), signature: signature.trim() },
    });
    setSubmitting(false);
    if (error || data?.error) { toast.error(data?.error || "Something went wrong"); return; }
    setEstimate(data as EstimateView);
    toast.success(action === "accept" ? "Estimate accepted" : "Estimate declined");
  };

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-muted/30"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (notFound || !estimate) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30 p-4">
        <Card className="max-w-md p-8 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">Estimate not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This link may be incorrect or the estimate may have been removed.</p>
        </Card>
      </div>
    );
  }

  const accentColor = estimate.brandColor || "#3b82f6";

  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="mx-auto max-w-2xl px-4">
        <Card className="overflow-hidden">
          <div className="h-2" style={{ background: accentColor }} />
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Estimate</p>
                <h1 className="mt-1 text-xl font-semibold">{estimate.title}</h1>
                {estimate.customerName && <p className="mt-1 text-sm text-muted-foreground">Prepared for {estimate.customerName}</p>}
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div className="font-medium text-foreground">{estimate.companyName || "Your contractor"}</div>
                {estimate.companyPhone && <div>{estimate.companyPhone}</div>}
                {estimate.companyEmail && <div>{estimate.companyEmail}</div>}
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="p-3">Description</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Price</th><th className="p-3 text-right">Total</th></tr>
                </thead>
                <tbody>
                  {estimate.lineItems.map((li, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-3">{li.description}</td>
                      <td className="p-3 text-right tabular-nums">{li.quantity}</td>
                      <td className="p-3 text-right tabular-nums">{fmt(li.unit_price)}</td>
                      <td className="p-3 text-right tabular-nums">{fmt(li.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto mt-4 w-56 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(estimate.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{fmt(estimate.tax)}</span></div>
              <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span>{fmt(estimate.total)}</span></div>
              {estimate.depositRequired != null && (
                <div className="flex justify-between text-muted-foreground"><span>Deposit required</span><span>{fmt(estimate.depositRequired)}{estimate.depositCollected ? " (paid)" : ""}</span></div>
              )}
            </div>

            {estimate.notes && (
              <div className="mt-6 whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">{estimate.notes}</div>
            )}

            <div className="mt-8 border-t border-border pt-6">
              {estimate.status === "approved" ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <div className="text-sm">
                    <div className="font-medium">Accepted{estimate.acceptedByName ? ` by ${estimate.acceptedByName}` : ""}</div>
                    {estimate.acceptedAt && <div className="text-emerald-700/80">{new Date(estimate.acceptedAt).toLocaleString()}</div>}
                  </div>
                </div>
              ) : estimate.status === "rejected" ? (
                <div className="flex items-center gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-rose-700">
                  <XCircle className="h-5 w-5 shrink-0" />
                  <div className="text-sm font-medium">This estimate was declined.</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="signName">Type your full name to sign and accept</Label>
                    <Input id="signName" value={name} onChange={(e) => { setName(e.target.value); setSignature(e.target.value); }} placeholder="Your full name" />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button className="flex-1" disabled={submitting} onClick={() => respond("accept")}>
                      {submitting ? "Submitting…" : "Accept & Sign"}
                    </Button>
                    <Button variant="outline" disabled={submitting} onClick={() => respond("decline")}>Decline</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">By typing your name and clicking Accept & Sign, you agree this serves as your electronic signature approving this estimate as written.</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
