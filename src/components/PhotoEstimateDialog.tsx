import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Camera, Loader2, X, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

const MAX_IMAGES = 6;
const MAX_DIMENSION = 1600;

type Confidence = "high" | "medium" | "low";
type ReferenceObject = { object: string; assumed_real_world_size: string; confidence: Confidence };
type Measurement = { area_description: string; estimated_dimensions: string; confidence: Confidence };
type DraftLineItem = {
  description: string;
  quantity: number;
  unit: string;
  matched_material_id: string | null;
  unit_price: number | null;
  price_required: boolean;
};
type Draft = {
  reference_objects: ReferenceObject[];
  measurements: Measurement[];
  line_items: DraftLineItem[];
  caveats: string;
};

type PhotoEstimateDialogProps = {
  organizationId: string;
  onDraftReady: (draft: { title: string; notes: string; items: { description: string; quantity: number; unit_price: number }[] }) => void;
};

function downscaleToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read photo"));
    reader.onload = () => {
      img.onerror = () => reject(new Error("Could not decode photo"));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const confidenceColor: Record<Confidence, string> = {
  high: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  low: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

export function PhotoEstimateDialog({ organizationId, onDraftReady }: PhotoEstimateDialogProps) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [jobTitle, setJobTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setImages([]); setJobTitle(""); setNotes(""); setDraft(null);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) { toast.error(`You can attach up to ${MAX_IMAGES} photos`); return; }
    const picked = Array.from(files).slice(0, room);
    try {
      const encoded = await Promise.all(picked.map(downscaleToDataUrl));
      setImages((prev) => [...prev, ...encoded]);
    } catch (error) {
      toast.error((error as Error).message || "Could not read one of those photos");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const analyze = async () => {
    if (images.length === 0) { toast.error("Add at least one photo"); return; }
    setAnalyzing(true);
    setDraft(null);
    try {
      const { data, error } = await supabase.functions.invoke("estimate-from-photos", {
        body: {
          organizationId,
          environment: getPaddleEnvironment(),
          images,
          jobTitle: jobTitle || undefined,
          notes: notes || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDraft(data.draft as Draft);
    } catch (error) {
      const message = (error as Error).message || "Could not analyze those photos";
      toast.error(message.includes("subscription_required") || message.includes("Subscription")
        ? "AI photo estimates need a Plus or Premium plan"
        : message);
    }
    setAnalyzing(false);
  };

  const useDraft = () => {
    if (!draft) return;
    const items = draft.line_items.map((li) => ({
      description: li.price_required
        ? `⚠ Price needed — ${li.description} (${li.unit})`
        : `${li.description} (${li.unit})`,
      quantity: Number(li.quantity) || 0,
      unit_price: li.price_required ? 0 : Number(li.unit_price ?? 0),
    }));
    const measurementsText = draft.measurements
      .map((m) => `- ${m.area_description}: ${m.estimated_dimensions} (${m.confidence} confidence)`)
      .join("\n");
    const referenceText = draft.reference_objects
      .map((r) => `- ${r.object} (~${r.assumed_real_world_size}, ${r.confidence} confidence)`)
      .join("\n");
    const notesBlock = [
      "AI PHOTO ESTIMATE — DRAFT, VERIFY ON-SITE BEFORE QUOTING",
      draft.caveats,
      measurementsText ? `\nEstimated measurements:\n${measurementsText}` : "",
      referenceText ? `\nReference objects used for scale:\n${referenceText}` : "",
    ].filter(Boolean).join("\n");

    onDraftReady({ title: jobTitle || "Photo estimate", notes: notesBlock, items });
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Camera className="h-4 w-4" /> New estimate from photos</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>AI photo estimate</DialogTitle>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            The AI estimates measurements from objects it recognizes in your photos (doors, outlet
            plates, etc.). Treat every number as a rough draft — always verify on-site before quoting.
          </span>
        </div>

        <div className="grid gap-3">
          <div>
            <Label>Photos ({images.length}/{MAX_IMAGES})</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {images.map((src, i) => (
                <div key={i} className="relative h-16 w-16 overflow-hidden rounded-md border border-border">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute right-0 top-0 rounded-bl bg-background/80 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="grid h-16 w-16 place-items-center rounded-md border border-dashed border-border text-muted-foreground hover:bg-secondary/40"
                >
                  <Camera className="h-5 w-5" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          <div>
            <Label htmlFor="pe_title">Job title (optional)</Label>
            <Input id="pe_title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Living room repaint" />
          </div>
          <div>
            <Label htmlFor="pe_notes">Anything the AI should know? (optional)</Label>
            <Textarea id="pe_notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. two coats, ceiling included" />
          </div>
        </div>

        {draft && (
          <div className="space-y-3 rounded-md border border-border bg-secondary/20 p-3 text-sm">
            {draft.measurements.length > 0 && (
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">Estimated measurements</div>
                <ul className="mt-1 space-y-1">
                  {draft.measurements.map((m, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span>{m.area_description}: {m.estimated_dimensions}</span>
                      <Badge variant="outline" className={confidenceColor[m.confidence]}>{m.confidence}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {draft.reference_objects.length > 0 && (
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">Used for scale</div>
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  {draft.reference_objects.map((r, i) => (
                    <li key={i}>{r.object} (~{r.assumed_real_world_size})</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{draft.caveats}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          {draft ? (
            <Button onClick={useDraft}>Use this draft</Button>
          ) : (
            <Button onClick={analyze} disabled={analyzing || images.length === 0}>
              {analyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…</> : "Analyze photos"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
