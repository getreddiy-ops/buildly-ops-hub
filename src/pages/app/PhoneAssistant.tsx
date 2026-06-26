import { useState } from "react";
import { Phone, PhoneIncoming, PhoneOff, Voicemail, Clock, Sparkles, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Call = {
  id: string;
  caller: string;
  number: string;
  at: string;
  duration: string;
  outcome: "Booked estimate" | "Took message" | "Transferred" | "Voicemail";
  summary: string;
};

const SAMPLE_CALLS: Call[] = [
  {
    id: "1",
    caller: "Maria Gonzales",
    number: "+1 (415) 555-0182",
    at: "Today, 10:42 AM",
    duration: "3m 18s",
    outcome: "Booked estimate",
    summary: "Kitchen remodel inquiry. Wants estimate next Tue between 1–4 PM. Address captured. Created lead + scheduled visit.",
  },
  {
    id: "2",
    caller: "Unknown",
    number: "+1 (628) 555-0119",
    at: "Today, 9:11 AM",
    duration: "1m 02s",
    outcome: "Took message",
    summary: "Asked about pricing for a deck rebuild. Left callback number, prefers texts after 5pm.",
  },
  {
    id: "3",
    caller: "Dan Pierce",
    number: "+1 (510) 555-0144",
    at: "Yesterday, 4:55 PM",
    duration: "0m 47s",
    outcome: "Transferred",
    summary: "Existing customer, asked about invoice #1042. Transferred to office line.",
  },
];

export default function PhoneAssistant() {
  const [enabled, setEnabled] = useState(true);
  const [forwarding, setForwarding] = useState("");
  const [greeting, setGreeting] = useState(
    "Hi, you've reached our office. Our virtual assistant can help schedule an estimate, take a message, or transfer you to a team member.",
  );
  const [voice, setVoice] = useState("Aria");
  const [calls] = useState<Call[]>(SAMPLE_CALLS);
  const [open, setOpen] = useState(false);
  const [newNumber, setNewNumber] = useState("");

  const handleSave = () => {
    toast.success("Phone assistant settings saved");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Phone className="h-7 w-7 text-primary" />
            Phone Assistant
          </h1>
          <p className="mt-1 text-muted-foreground">
            24/7 AI receptionist that answers calls, books estimates, and logs every conversation.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Provision number
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Provision a new phone number</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label>Area code</Label>
              <Input
                placeholder="e.g. 415"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                We'll provision a local number you can forward your business line to.
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  toast.success("Number request submitted");
                  setOpen(false);
                  setNewNumber("");
                }}
              >
                Request number
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={PhoneIncoming} label="Calls answered (7d)" value="42" />
        <StatCard icon={Sparkles} label="Estimates booked" value="11" />
        <StatCard icon={Clock} label="Avg handle time" value="2m 14s" />
        <StatCard icon={Voicemail} label="Voicemails" value="3" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-5 p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Assistant configuration</h2>
              <p className="text-sm text-muted-foreground">
                Customize how your AI receptionist greets and handles callers.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={enabled} onCheckedChange={setEnabled} id="enabled" />
              <Label htmlFor="enabled" className="text-sm">
                {enabled ? "Active" : "Paused"}
              </Label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="voice">Voice</Label>
              <select
                id="voice"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option>Aria</option>
                <option>Cole</option>
                <option>Nova</option>
                <option>River</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="forward">Transfer-to number</Label>
              <Input
                id="forward"
                placeholder="+1 (555) 000-0000"
                value={forwarding}
                onChange={(e) => setForwarding(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="greeting">Greeting script</Label>
            <Textarea
              id="greeting"
              rows={4}
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Capabilities</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                "Book estimates on calendar",
                "Capture lead details",
                "Send SMS follow-up",
                "Transfer to a teammate",
                "Take voicemail",
                "Answer FAQ from knowledge base",
              ].map((c) => (
                <label key={c} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave}>Save changes</Button>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Routing</h2>
            <p className="text-sm text-muted-foreground">
              How calls reach your assistant.
            </p>
          </div>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Assistant number</div>
              <div className="font-mono">+1 (415) 555-0100</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Forwarded from</div>
              <div className="font-mono">{forwarding || "Not configured"}</div>
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Set up call forwarding on your business line so missed and after-hours calls land here automatically.
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Recent calls</h2>
            <p className="text-sm text-muted-foreground">
              Every conversation is transcribed and summarized.
            </p>
          </div>
        </div>
        <div className="divide-y">
          {calls.map((c) => (
            <div key={c.id} className="grid gap-2 py-4 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <div className="font-medium">{c.caller}</div>
                <div className="text-xs text-muted-foreground">{c.number}</div>
              </div>
              <div className="text-xs text-muted-foreground sm:col-span-2">
                <div>{c.at}</div>
                <div>{c.duration}</div>
              </div>
              <div className="sm:col-span-2">
                <OutcomeBadge outcome={c.outcome} />
              </div>
              <div className="text-sm text-muted-foreground sm:col-span-5">
                {c.summary}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value,
}: { icon: typeof Phone; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </div>
    </Card>
  );
}

function OutcomeBadge({ outcome }: { outcome: Call["outcome"] }) {
  const map: Record<Call["outcome"], { className: string; icon: typeof Phone }> = {
    "Booked estimate": { className: "bg-primary/15 text-primary", icon: Sparkles },
    "Took message": { className: "bg-muted text-foreground", icon: PhoneIncoming },
    "Transferred": { className: "bg-accent text-accent-foreground", icon: Phone },
    "Voicemail": { className: "bg-muted text-muted-foreground", icon: PhoneOff },
  };
  const { className, icon: Icon } = map[outcome];
  return (
    <Badge variant="secondary" className={`gap-1 ${className}`}>
      <Icon className="h-3 w-3" /> {outcome}
    </Badge>
  );
}
