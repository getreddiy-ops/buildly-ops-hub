import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Check, Globe2, Loader2, Palette, ScanSearch, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type BrandScan = {
  companyName: string;
  website: string;
  primaryColor: string;
  secondaryColor: string;
  logo: { data: string; contentType: string; sourceUrl: string } | null;
};

function base64ToBlob(data: string, contentType: string) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: contentType });
}

function extensionFor(contentType: string) {
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg")) return "jpg";
  return "png";
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, memberships, loading, refresh, setActiveOrgId, signOut, isPlatformAdmin, isAgent } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#ff5a2a");
  const [secondaryColor, setSecondaryColor] = useState("#241812");
  const [brand, setBrand] = useState<BrandScan | null>(null);
  const [manualLogo, setManualLogo] = useState<File | null>(null);
  const [manualLogoPreview, setManualLogoPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [companyCreated, setCompanyCreated] = useState(false);
  const isDesignPreview = import.meta.env.DEV && window.location.pathname === "/onboarding-preview";

  useEffect(() => {
    if (isDesignPreview) return;
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (memberships.length > 0 && !companyCreated) {
      navigate("/app", { replace: true });
      return;
    }
    if (isPlatformAdmin) navigate("/admin", { replace: true });
    else if (isAgent) navigate("/agent", { replace: true });
  }, [user, loading, memberships, isPlatformAdmin, isAgent, companyCreated, navigate, isDesignPreview]);

  useEffect(() => () => {
    if (manualLogoPreview) URL.revokeObjectURL(manualLogoPreview);
  }, [manualLogoPreview]);

  const scanWebsite = async () => {
    if (!website.trim()) return;
    setScanning(true);
    const { data, error } = await supabase.functions.invoke<BrandScan>("crawl-brand", {
      body: { website: website.trim() },
    });
    setScanning(false);
    if (error || !data) {
      toast({
        title: "We could not read that website",
        description: "You can keep going and upload a logo or choose colors manually.",
        variant: "destructive",
      });
      return;
    }
    setBrand(data);
    setWebsite(data.website);
    setCompanyName((current) => current || data.companyName);
    setPrimaryColor(data.primaryColor);
    setSecondaryColor(data.secondaryColor);
    toast({ title: "Brand found", description: "Review the logo and colors before creating your workspace." });
  };

  const chooseLogo = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Logo is too large", description: "Choose an image under 2MB.", variant: "destructive" });
      return;
    }
    if (manualLogoPreview) URL.revokeObjectURL(manualLogoPreview);
    setManualLogo(file);
    setManualLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: companyName,
        owner_id: user.id,
        website: website || null,
        brand_color: primaryColor,
        brand_color_secondary: secondaryColor,
      })
      .select()
      .single();
    if (orgError || !org) {
      setSubmitting(false);
      return toast({ title: "Could not create company", description: orgError?.message, variant: "destructive" });
    }
    const { error: memberError } = await supabase
      .from("organization_members")
      .insert({ organization_id: org.id, user_id: user.id, role: "owner" });
    if (memberError) {
      setSubmitting(false);
      return toast({ title: "Could not add you as owner", description: memberError.message, variant: "destructive" });
    }

    let logoBlob: Blob | File | null = manualLogo;
    let logoContentType = manualLogo?.type || "image/png";
    if (!logoBlob && brand?.logo) {
      logoContentType = brand.logo.contentType;
      logoBlob = base64ToBlob(brand.logo.data, logoContentType);
    }
    if (logoBlob) {
      const logoPath = `${org.id}/logo-onboarding.${extensionFor(logoContentType)}`;
      const { error: uploadError } = await supabase.storage.from("branding").upload(logoPath, logoBlob, {
        contentType: logoContentType,
        upsert: true,
      });
      if (!uploadError) await supabase.from("organizations").update({ logo_url: logoPath }).eq("id", org.id);
    }

    setSubmitting(false);
    setCompanyCreated(true);
    setActiveOrgId(org.id);
    await refresh();
    toast({ title: "Your workspace is ready", description: `${org.name} now has its own FastTract style.` });
    navigate("/pricing?onboarding=complete", { replace: true });
  };

  const logoPreview = manualLogoPreview || (brand?.logo ? `data:${brand.logo.contentType};base64,${brand.logo.data}` : null);

  return (
    <div className="min-h-screen bg-gradient-dark">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
        <Logo />
        <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/login"); }}>Sign out</Button>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Personalize your workspace</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Make FastTract look like your company.</h1>
          <p className="mt-3 text-muted-foreground">Enter your website and we’ll find your public logo and brand colors. You approve everything before it becomes your dashboard style.</p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
            <section>
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary"><Globe2 className="h-4 w-4" /></span>
                <div><h2 className="font-semibold">Find your brand</h2><p className="text-xs text-muted-foreground">We only scan public pages and images.</p></div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  type="url"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  placeholder="https://yourcompany.com"
                  aria-label="Company website"
                />
                <Button type="button" variant="outline" onClick={scanWebsite} disabled={scanning || !website.trim()} className="shrink-0">
                  {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-2 h-4 w-4" />}
                  {scanning ? "Scanning…" : "Find my brand"}
                </Button>
              </div>
            </section>

            <section className="border-t border-border pt-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary"><Building2 className="h-4 w-4" /></span>
                <div><h2 className="font-semibold">Company details</h2><p className="text-xs text-muted-foreground">This begins your agent’s knowledge base.</p></div>
              </div>
              <Label htmlFor="company">Company name</Label>
              <Input id="company" required value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Acme Services" className="mt-2" />
            </section>

            <section className="border-t border-border pt-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary"><Palette className="h-4 w-4" /></span>
                <div><h2 className="font-semibold">Logo and colors</h2><p className="text-xs text-muted-foreground">Adjust anything the scan did not get right.</p></div>
              </div>
              <div className="grid gap-5 sm:grid-cols-[140px_1fr]">
                <div>
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex h-28 w-full items-center justify-center rounded-xl border border-dashed border-border bg-background/50 p-3 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    {logoPreview ? <img src={logoPreview} alt="Detected company logo" className="max-h-20 max-w-full object-contain" /> : <span className="text-center text-xs text-muted-foreground"><Upload className="mx-auto mb-2 h-5 w-5" />Upload logo</span>}
                  </button>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) chooseLogo(file); }} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Primary color</Label>
                    <div className="mt-2 flex gap-2"><input type="color" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} className="h-10 w-12 rounded border border-border bg-transparent" /><Input value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} className="font-mono uppercase" /></div>
                  </div>
                  <div>
                    <Label className="text-xs">Secondary color</Label>
                    <div className="mt-2 flex gap-2"><input type="color" value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value)} className="h-10 w-12 rounded border border-border bg-transparent" /><Input value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value)} className="font-mono uppercase" /></div>
                  </div>
                </div>
              </div>
            </section>

            <Button type="submit" size="lg" className="w-full" disabled={submitting || !companyName.trim()}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating your workspace…</> : "Use this brand & continue"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">You can change the logo, colors, and company details later.</p>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Dashboard preview</p>
            <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-2xl" style={{ "--preview-brand": primaryColor } as React.CSSProperties}>
              <div className="flex items-center gap-3 border-b border-border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card p-1">{logoPreview ? <img src={logoPreview} alt="" className="max-h-8 max-w-8 object-contain" /> : <Building2 className="h-5 w-5" style={{ color: primaryColor }} />}</div>
                <div><p className="font-semibold">{companyName || "Your company"}</p><p className="text-xs text-muted-foreground">FastTract workspace</p></div>
              </div>
              <div className="grid grid-cols-[96px_1fr]">
                <div className="space-y-3 border-r border-border p-3 text-xs text-muted-foreground">
                  {["Today", "Customers", "Operations", "Business"].map((item, index) => <div key={item} className="rounded-md px-2 py-2" style={index === 0 ? { color: primaryColor, backgroundColor: `${primaryColor}18` } : undefined}>{item}</div>)}
                </div>
                <div className="p-4">
                  <p className="text-lg font-semibold">Your day</p>
                  <div className="mt-4 rounded-lg border border-border p-3">
                    <p className="text-xs font-medium">Agent ready 24/7</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Ask FastTract to handle anything.</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {[1, 2, 3].map((item) => <div key={item} className="h-8 rounded-md bg-card" />)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-border p-3 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" style={{ color: primaryColor }} />Your colors will be applied automatically</div>
            </div>
            <div className="mt-4 rounded-xl border border-border bg-card/70 p-4 text-xs leading-relaxed text-muted-foreground">
              FastTract saves the approved brand—not the website page. Private pages, passwords, and customer data are never requested.
            </div>
          </aside>
        </form>
      </main>
    </div>
  );
}
