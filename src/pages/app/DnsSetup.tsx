import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, Circle, Copy, Globe, Mail, Server,
  AlertCircle, ExternalLink, RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type DnsRecord = {
  type: string;
  name: string;
  value: string;
  ttl?: string;
  priority?: string;
  note?: string;
};

const STEPS = [
  { id: "overview", label: "Overview" },
  { id: "sender", label: "Sending domain (notify.fasttract.org)" },
  { id: "mailbox", label: "Mailbox (fasttract.org)" },
  { id: "verify", label: "Verify" },
];

const EXAMPLE_MX_RECORDS: DnsRecord[] = [
  { type: "MX", name: "@", value: "mx1.zoho.com", priority: "10", ttl: "3600" },
  { type: "MX", name: "@", value: "mx2.zoho.com", priority: "20", ttl: "3600" },
  { type: "MX", name: "@", value: "mx3.zoho.com", priority: "50", ttl: "3600" },
];

export default function DnsSetup() {
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [nsValues, setNsValues] = useState<DnsRecord[]>([
    { type: "NS", name: "notify", value: "ns1.lovable.cloud", ttl: "3600" },
    { type: "NS", name: "notify", value: "ns2.lovable.cloud", ttl: "3600" },
  ]);
  const [mxProvider, setMxProvider] = useState<"google" | "zoho" | "microsoft" | "other">("zoho");

  const toggle = (key: string) => setChecked((c) => ({ ...c, [key]: !c[key] }));

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const updateNs = (idx: number, value: string) => {
    setNsValues((prev) => prev.map((r, i) => (i === idx ? { ...r, value } : r)));
  };

  const mxRecords = mxProvider === "google"
    ? [
        { type: "MX", name: "@", value: "aspmx.l.google.com", priority: "1", ttl: "3600" },
        { type: "MX", name: "@", value: "alt1.aspmx.l.google.com", priority: "5", ttl: "3600" },
        { type: "MX", name: "@", value: "alt2.aspmx.l.google.com", priority: "5", ttl: "3600" },
        { type: "MX", name: "@", value: "alt3.aspmx.l.google.com", priority: "10", ttl: "3600" },
        { type: "MX", name: "@", value: "alt4.aspmx.l.google.com", priority: "10", ttl: "3600" },
      ]
    : mxProvider === "microsoft"
    ? [
        { type: "MX", name: "@", value: "fasttract-org.mail.protection.outlook.com", priority: "0", ttl: "3600" },
      ]
    : mxProvider === "zoho"
    ? EXAMPLE_MX_RECORDS
    : [];

  const progress = Math.round(
    (Object.values(checked).filter(Boolean).length / 8) * 100
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Domain & email setup"
        description="Connect fasttract.org to FastTract so emails come from your own domain."
      />

      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/settings">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to settings
          </Link>
        </Button>
      </div>

      {/* Progress */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-semibold">Setup progress</div>
            <div className="text-sm text-muted-foreground">
              Complete each section, then verify in Cloud → Emails.
            </div>
          </div>
          <Badge variant={progress === 100 ? "default" : "secondary"}>
            {progress}% complete
          </Badge>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                  ? "bg-secondary text-secondary-foreground"
                  : "border border-border text-muted-foreground hover:bg-secondary/40"
              }`}
            >
              {i + 1}. {s.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Step 0: Overview */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              What you are connecting
            </CardTitle>
            <CardDescription>
              You need two independent DNS setups on <strong>fasttract.org</strong> at Name.com.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/60 p-4">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">1. Branded sending email</div>
                  <p className="text-sm text-muted-foreground">
                    Emails from FastTract will come from{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">noreply@notify.fasttract.org</code>.
                    Lovable manages SPF, DKIM, and DMARC automatically once you delegate the{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">notify</code> subdomain.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <div className="flex items-start gap-3">
                <Server className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">2. Support mailbox</div>
                  <p className="text-sm text-muted-foreground">
                    A real inbox such as{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">support@fasttract.org</code>{" "}
                    so customers can reply to you. You add MX records at Name.com for the root domain.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-accent/30 p-4 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-accent-foreground" />
                <span>
                  These two setups do not conflict. Lovable only controls the{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">notify</code> subdomain; your mailbox
                  provider controls the root domain.
                </span>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(1)}>Start sender-domain setup</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Sender domain NS records */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Add NS records for notify.fasttract.org
            </CardTitle>
            <CardDescription>
              Delegate the <code className="rounded bg-muted px-1 py-0.5 text-xs">notify</code> subdomain to
              Lovable so FastTract can send branded email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg bg-secondary/40 p-4 text-sm">
              <p className="font-medium">Where to get the exact values</p>
              <p className="text-muted-foreground">
                Click the button below to open Cloud → Emails. After you choose{" "}
                <strong>fasttract.org</strong>, Lovable will show the exact nameserver values for the
                delegated subdomain. Paste those values into the fields here, then copy them to Name.com.
              </p>
              <div className="mt-3">
                <Button variant="outline" size="sm" asChild>
                  <a href="/" onClick={(e) => { e.preventDefault(); window.openEmailSetup?.(); }}>
                    Open email setup <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nameserver records (add both at Name.com)</Label>
              {nsValues.map((r, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-12">
                  <div className="sm:col-span-2">
                    <Input value={r.type} disabled className="font-mono" />
                  </div>
                  <div className="sm:col-span-3">
                    <Input value={r.name} disabled className="font-mono" />
                  </div>
                  <div className="sm:col-span-5">
                    <Input
                      value={r.value}
                      onChange={(e) => updateNs(i, e.target.value)}
                      placeholder={`ns${i + 1}.lovable.cloud`}
                      className="font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input value={r.ttl} disabled className="font-mono" />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button onClick={() => toggle("ns_namecom")}>
                  {checked.ns_namecom ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <span className="text-sm">I added both NS records at Name.com for the notify subdomain.</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggle("ns_cloud")}>
                  {checked.ns_cloud ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <span className="text-sm">I clicked Verify Domain in Cloud → Emails.</span>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
              <Button onClick={() => setStep(2)}>Continue to mailbox setup</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Mailbox MX records */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Add MX records for fasttract.org
            </CardTitle>
            <CardDescription>
              Choose where your support inbox will live. Add the provider's MX records to the root domain
              at Name.com.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(["google", "microsoft", "zoho", "other"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setMxProvider(p)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    mxProvider === p
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-secondary/40"
                  }`}
                >
                  <div className="font-semibold capitalize">
                    {p === "microsoft" ? "Microsoft 365" : p === "other" ? "Other host" : p}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p === "google" && "aspmx.l.google.com"}
                    {p === "microsoft" && "protection.outlook.com"}
                    {p === "zoho" && "mx.zoho.com"}
                    {p === "other" && "Paste your own records"}
                  </div>
                </button>
              ))}
            </div>

            {mxProvider !== "other" ? (
              <div className="space-y-2">
                <Label>MX records to add at Name.com</Label>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Type</th>
                        <th className="px-3 py-2 text-left font-medium">Name</th>
                        <th className="px-3 py-2 text-left font-medium">Priority</th>
                        <th className="px-3 py-2 text-left font-medium">Value</th>
                        <th className="px-3 py-2 text-left font-medium">TTL</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {mxRecords.map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2 font-mono">{r.type}</td>
                          <td className="px-3 py-2 font-mono">{r.name}</td>
                          <td className="px-3 py-2 font-mono">{r.priority}</td>
                          <td className="px-3 py-2 font-mono">{r.value}</td>
                          <td className="px-3 py-2 font-mono">{r.ttl}</td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                copy(
                                  `${r.type} ${r.name} ${r.priority} ${r.value} ${r.ttl}`,
                                  "Record"
                                )
                              }
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-accent/30 p-4 text-sm">
                Select your mailbox host above, or ask your email host for the exact MX records and add
                them manually at Name.com.
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button onClick={() => toggle("mx_namecom")}>
                  {checked.mx_namecom ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <span className="text-sm">I added the MX records at Name.com for the root domain.</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggle("mx_inbox")}>
                  {checked.mx_inbox ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <span className="text-sm">I created the support inbox (e.g. support@fasttract.org).</span>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Verify setup</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Verify */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Verify and finish
            </CardTitle>
            <CardDescription>
              DNS changes can take up to 72 hours. Use these checks to confirm everything is working.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 p-4">
                <div className="mb-2 font-semibold">Sender domain</div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    Cloud → Emails shows notify.fasttract.org as verified.
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    A test auth email arrives from noreply@notify.fasttract.org.
                  </li>
                </ul>
              </div>
              <div className="rounded-lg border border-border/60 p-4">
                <div className="mb-2 font-semibold">Mailbox</div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    You can log in to your mailbox host and read mail.
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    Sending a message to support@fasttract.org lands in the inbox.
                  </li>
                </ul>
              </div>
            </div>

            <div className="rounded-lg bg-secondary/40 p-4 text-sm">
              <p className="font-medium">Stuck?</p>
              <p className="text-muted-foreground">
                If Name.com does not let you add NS records, you can transfer fasttract.org into Lovable
                (Workspace settings → Workspace domains) or move DNS hosting to Cloudflare. Both options
                support NS delegation.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button asChild>
                <Link to="/app/settings">
                  Finish and return to settings
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
