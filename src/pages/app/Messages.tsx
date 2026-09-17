import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Send, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Customer = { id: string; name: string; email: string | null; phone: string | null };

export default function Messages() {
  const { activeOrg } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!activeOrg) return;
    supabase
      .from("customers")
      .select("id,name,email,phone")
      .eq("organization_id", activeOrg.organization_id)
      .order("name")
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setCustomers((data ?? []) as Customer[]);
      });
  }, [activeOrg?.organization_id]);

  const customer = useMemo(() => customers.find((c) => c.id === customerId) ?? null, [customers, customerId]);
  const canSend = !!customer?.phone && !!message.trim();

  const send = async () => {
    if (!activeOrg || !customer || !canSend) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("fasttract-message", {
        body: {
          organizationId: activeOrg.organization_id,
          customerId: customer.id,
          message: message.trim(),
        },
      });
      if (error) {
        let detail = error.message || "Could not send text";
        const context = (error as any).context;
        if (context instanceof Response) {
          try {
            const body = await context.clone().json();
            detail = body?.error || detail;
          } catch {}
        }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message ?? "Text sent");
      setMessage("");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send text");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader title="Messages" description="Send customer texts directly through FastTract." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> New text</CardTitle>
            <CardDescription>Select a customer and send without leaving FastTract.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {customer && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                {customer.phone || "This customer does not have a phone number yet."}
              </div>
            )}

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                rows={7}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi — we're on our way..."
              />
            </div>

            <Button onClick={send} disabled={!canSend || sending}>
              <Send className="mr-2 h-4 w-4" /> {sending ? "Sending…" : "Send text"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" /> FastTract messaging</CardTitle>
            <CardDescription>No CRM bridge required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Texts are sent by FastTract through the business phone connection and logged to FastTract.</p>
            <p>Use this for appointment confirmations, estimate follow-ups, arrival notices, and payment reminders.</p>
            <p>Email is being moved to FastTract separately instead of falling back to the old GHL route.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
