import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding, DocumentDefaults, DocumentTemplate } from "@/hooks/useBranding";
import { DocumentPreview } from "@/components/DocumentPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, Trash2, Palette } from "lucide-react";

type DocType = keyof DocumentDefaults;

export default function Branding() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.organization_id;
  const { branding, refresh } = useBranding();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [taxId, setTaxId] = useState("");
  const [brandColor, setBrandColor] = useState("#3b82f6");
  const [brandColor2, setBrandColor2] = useState("#1e293b");
  const [docs, setDocs] = useState<DocumentDefaults>({});
  const [activeDoc, setActiveDoc] = useState<DocType>("estimate");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!branding) return;
    setName(branding.name ?? "");
    setLegalName(branding.legal_name ?? "");
    setAddress(branding.address ?? "");
    setPhone(branding.phone ?? "");
    setEmail(branding.email ?? "");
    setWebsite(branding.website ?? "");
    setTaxId(branding.tax_id ?? "");
    setBrandColor(branding.brand_color ?? "#3b82f6");
    setBrandColor2(branding.brand_color_secondary ?? "#1e293b");
    setDocs(branding.document_defaults ?? {});
  }, [branding]);

  const updateDoc = (field: keyof DocumentTemplate, val: string) =>
    setDocs((d) => ({ ...d, [activeDoc]: { ...d[activeDoc], [field]: val } }));

  const onUpload = async (file: File) => {
    if (!orgId) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${orgId}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("branding")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }
    // Remove old logo if any
    if (branding?.logo_url) {
      await supabase.storage.from("branding").remove([branding.logo_url]);
    }
    const { error } = await supabase
      .from("organizations")
      .update({ logo_url: path })
      .eq("id", orgId);
    if (error) toast.error(error.message);
    else {
      toast.success("Logo updated");
      await refresh();
    }
    setUploading(false);
  };

  const onRemoveLogo = async () => {
    if (!orgId || !branding?.logo_url) return;
    await supabase.storage.from("branding").remove([branding.logo_url]);
    await supabase.from("organizations").update({ logo_url: null }).eq("id", orgId);
    toast.success("Logo removed");
    refresh();
  };

  const save = async () => {
    if (!orgId) return;
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        name,
        legal_name: legalName || null,
        address: address || null,
        phone: phone || null,
        email: email || null,
        website: website || null,
        tax_id: taxId || null,
        brand_color: brandColor || null,
        brand_color_secondary: brandColor2 || null,
        document_defaults: docs as any,
      })
      .eq("id", orgId);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Branding saved");
      refresh();
    }
  };

  const previewBranding = branding
    ? {
        ...branding,
        name,
        legal_name: legalName,
        address,
        phone,
        email,
        website,
        tax_id: taxId,
        brand_color: brandColor,
        brand_color_secondary: brandColor2,
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Branding &amp; Documents</h1>
        <p className="text-sm text-muted-foreground">
          Customize your logo, brand color, and what appears on every estimate, invoice, and contract.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Logo
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-md border border-border bg-card">
                {branding?.logo_signed_url ? (
                  <img
                    src={branding.logo_signed_url}
                    alt="Organization logo"
                    className="max-h-16 max-w-16 object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUpload(f);
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? "Uploading…" : "Upload logo"}
                </Button>
                {branding?.logo_url && (
                  <Button size="sm" variant="ghost" onClick={onRemoveLogo}>
                    <Trash2 className="mr-2 h-4 w-4" /> Remove
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">PNG, JPG, WebP, or SVG. Under 2MB.</p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Palette className="mr-2 inline h-4 w-4" />
              Brand colors
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Primary (accent)</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <Input
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="font-mono uppercase"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Secondary</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={brandColor2}
                    onChange={(e) => setBrandColor2(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <Input
                    value={brandColor2}
                    onChange={(e) => setBrandColor2(e.target.value)}
                    className="font-mono uppercase"
                  />
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Primary recolors dashboard buttons, links, and active nav. Both show on documents.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Company info
            </h2>
            <div className="space-y-3">
              <div>
                <Label>Display name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Legal business name</Label>
                <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
              </div>
              <div>
                <Label>Address</Label>
                <Textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>
                <div>
                  <Label>Tax ID / License</Label>
                  <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Document templates
            </h2>
            <Tabs value={activeDoc} onValueChange={(v) => setActiveDoc(v as DocType)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="estimate">Estimate</TabsTrigger>
                <TabsTrigger value="invoice">Invoice</TabsTrigger>
                <TabsTrigger value="contract">Contract</TabsTrigger>
              </TabsList>
              {(["estimate", "invoice", "contract"] as DocType[]).map((d) => (
                <TabsContent key={d} value={d} className="space-y-3 pt-3">
                  <div>
                    <Label>Header message</Label>
                    <Textarea
                      rows={2}
                      placeholder="Thanks for considering us…"
                      value={docs[d]?.header ?? ""}
                      onChange={(e) => updateDoc("header", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Notes (shown above terms)</Label>
                    <Textarea
                      rows={2}
                      value={docs[d]?.notes ?? ""}
                      onChange={(e) => updateDoc("notes", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Terms &amp; conditions</Label>
                    <Textarea
                      rows={5}
                      placeholder="Payment due within 30 days…"
                      value={docs[d]?.terms ?? ""}
                      onChange={(e) => updateDoc("terms", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Footer</Label>
                    <Input
                      placeholder="Thank you for your business!"
                      value={docs[d]?.footer ?? ""}
                      onChange={(e) => updateDoc("footer", e.target.value)}
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </Card>

          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save branding"}
          </Button>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live preview — {activeDoc}
          </div>
          <DocumentPreview
            branding={previewBranding}
            type={activeDoc}
            documentNumber="PREVIEW-001"
            customerName="Sample Customer"
            customerAddress={"123 Main St\nAnytown, USA"}
            issueDate={new Date().toLocaleDateString()}
            dueDate={
              activeDoc === "invoice"
                ? new Date(Date.now() + 30 * 86400000).toLocaleDateString()
                : undefined
            }
            lineItems={
              activeDoc === "contract"
                ? []
                : [
                    { description: "Labor — 8 hrs @ $95", quantity: 8, unit_price: 95, total: 760 },
                    { description: "Materials", quantity: 1, unit_price: 425, total: 425 },
                  ]
            }
            subtotal={1185}
            taxRate={8.25}
            taxAmount={97.76}
            total={1282.76}
            body={
              activeDoc === "contract"
                ? "This Service Agreement (the \"Agreement\") is entered into between the company and the customer named above. The scope of work, payment terms, and timeline are described herein…"
                : undefined
            }
            template={docs[activeDoc]}
          />
        </div>
      </div>
    </div>
  );
}
