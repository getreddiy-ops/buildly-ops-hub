import { useEffect, useMemo, useState } from "react";
import { Mail, MessageSquare, Send, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Customer = { id: string; name: string; email: string | null; phone: string | null };
type Channel = "sms" | "email";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function Messages() {
  const { activeOrg } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [channel, setChannel] = useState<Channel>("sms");
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
  }, [activeOrg]);

  const customer = useMemo(() => customers.find((c) => c.id === customerId) ?? null, [customers, customerId]);
  const destination = channel === "sms" ? customer?.phone : customer?.email;
  const canSend = !!destination && !!message.trim();

  const send = async () => {
    if (!activeOrg || !customer || !canSend) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("fasttract-message", {
        body: {
          organizationId: activeOrg.organization_id,
          customerId: customer.id,
          channel,
          message: message.trim(),
        },
      });
      if (error) {
        let detail = error.message || "Could not send message";
        const context = (error as { context?: unknown }).context;
        if (context instanceof Response) {
          try {
            const body = await context.clone().json() as { error?: string };
            detail = body.error || detail;
          } catch {
            detail = detail || "Could not send message";
          }
        }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message ?? (channel === "sms" ? "Text sent" : "Email queued"));
      setMessage("");
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Could not send message"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader title="Messages" description="Send customer texts and email directly through FastTract." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> New message</CardTitle>
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

            <div className="space-y-2">
              <Label>Channel</Label>
              <Tabs value={channel} onValueChange={(value) => setChannel(value as Channel)}>
                <TabsList>
                  <TabsTrigger value="sms"><Smartphone className="mr-2 h-4 w-4" /> Text</TabsTrigger>
                  <TabsTrigger value="email"><Mail className="mr-2 h-4 w-4" /> Email</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {customer && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                {destination || (channel === "sms"
                  ? "This customer does not have a phone number yet."
                  : "This customer does not have an email address yet.")}
              </div>
            )}

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                rows={7}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={channel === "sms" ? "Hi — we're on our way..." : "Thanks for choosing us..."}
              />
            </div>

            <Button onClick={send} disabled={!canSend || sending}>
              <Send className="mr-2 h-4 w-4" /> {sending ? "Sending…" : `Send ${channel === "sms" ? "text" : "email"}`}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>FastTract messaging</CardTitle>
            <CardDescription>No CRM bridge required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Texts and emails are sent from FastTract and logged to the FastTract message history.</p>
            <p>Use messaging for appointment confirmations, estimate follow-ups, arrival notices, and payment reminders.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
