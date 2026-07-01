import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Send } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  docType: "estimate" | "invoice";
  docId: string;
  defaultEmail?: string | null;
  defaultPhone?: string | null;
  customerName?: string | null;
  onSent?: () => void;
};

export function SendDocumentDialog({
  open, onOpenChange, docType, docId, defaultEmail, defaultPhone, customerName, onSent,
}: Props) {
  const [channel, setChannel] = useState<"email" | "sms" | "both">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail ?? "");
      setPhone(defaultPhone ?? "");
      setMessage("");
      setChannel(defaultEmail ? "email" : defaultPhone ? "sms" : "email");
    }
  }, [open, defaultEmail, defaultPhone]);

  const send = async () => {
    if ((channel === "email" || channel === "both") && !email.trim()) {
      return toast.error("Recipient email is required");
    }
    if ((channel === "sms" || channel === "both") && !phone.trim()) {
      return toast.error("Recipient phone is required");
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-document", {
      body: {
        docType, docId, channel,
        to_email: email.trim() || undefined,
        to_phone: phone.trim() || undefined,
        message: message.trim() || undefined,
      },
    });
    setSending(false);
    if (error) return toast.error(error.message);
    const r = (data as any)?.results || {};
    const msgs: string[] = [];
    if (r.email) msgs.push(r.email.ok ? "Email queued" : `Email failed: ${r.email.error || r.email.reason || "unknown"}`);
    if (r.sms) msgs.push(r.sms.ok ? "SMS sent" : `SMS failed: ${typeof r.sms.error === "string" ? r.sms.error : "unknown"}`);
    if ((data as any)?.success) toast.success(msgs.join(" · ") || "Sent");
    else toast.error(msgs.join(" · ") || "Send failed");
    if ((data as any)?.success) {
      onOpenChange(false);
      onSent?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send {docType} {customerName ? `to ${customerName}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Send via</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS (text)</SelectItem>
                <SelectItem value="both">Email + SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(channel === "email" || channel === "both") && (
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Recipient email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            </div>
          )}
          {(channel === "sms" || channel === "both") && (
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Recipient phone (E.164)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+15551234567" />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Personal note (optional)</Label>
            <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Thanks for your business — let me know if you have any questions." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={sending}>
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
