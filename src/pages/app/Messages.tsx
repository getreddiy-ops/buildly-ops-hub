import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Send, Mail, Smartphone } from "lucide-react";
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
type Channel = "text" | "email";

export default function Messages() {
  const { activeOrg } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [channel, setChannel] = useState<Channel>("text");
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
  const canSend = !!customer && !!message.trim() && (channel === "text" ? !!customer.phone : !!customer.email);

  const send = async () => {
    if (!activeOrg || !customer || !canSend) return;
    setSending(true);
    try {
      const command = `${channel} ${customer.name}: ${message.trim()}`;
      const { data, error } = await supabase.functions.invoke("ghl-command", {
        body: { organizationId: activeOrg.organization_id, command },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message ?? `${channel === "text" ? "Text" : "Email"} sent`);
      setMessage("");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader title="Messages" description="Send customer SMS and email through your FastTract-connected GHL account." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> New message</CardTitle>
            <CardDescription>Select a customer, choose SMS or email, and send without leaving FastTract.</CardDescription>
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
              <Tabs value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                <TabsList>
                  <TabsTrigger value="text"><Smartphone className="mr-2 h-4 w-4" /> Text</TabsTrigger>
                  <TabsTrigger value="email"><Mail className="mr-2 h-4 w-4" /> Email</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {customer && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                {channel === "text"
                  ? customer.phone || "This customer does not have a phone number yet."
                  : customer.email || "This customer does not have an email address yet."}
              </div>
            )}

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                rows={7}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={channel === "text" ? "Hi — we're on our way..." : "Thanks for choosing us..."}
              />
            </div>

            <Button onClick={send} disabled={!canSend || sending}>
              <Send className="mr-2 h-4 w-4" /> {sending ? "Sending…" : `Send ${channel === "text" ? "text" : "email"}`}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>FastTract messaging</CardTitle>
            <CardDescription>Messages are delivered by the GHL account connected to FastTract.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Use this for appointment confirmations, estimate follow-ups, arrival notices, and payment reminders.</p>
            <p>The same write bridge also powers estimates, invoices, jobs, and clock-in/out commands.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
