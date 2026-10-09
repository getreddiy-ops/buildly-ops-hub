import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calculator } from "lucide-react";
import { toast } from "sonner";
import {
  calculateConcrete,
  type ConcreteJobType,
  type ConcreteCalcLine,
} from "@/lib/concreteCalc";

type Props = {
  onApply: (result: {
    title: string;
    notes: string;
    items: Array<{ description: string; quantity: number; unit_price: number }>;
  }) => void;
};

export function ConcreteCalculator({ onApply }: Props) {
  const [lengthFt, setLengthFt] = useState("");
  const [widthFt, setWidthFt] = useState("");
  const [thicknessIn, setThicknessIn] = useState("4");
  const [jobType, setJobType] = useState<ConcreteJobType>("slab");
  const [overagePct, setOveragePct] = useState("10");
  const [rebarSpacingIn, setRebarSpacingIn] = useState("18");
  const [includeRebar, setIncludeRebar] = useState(true);
  const [includeFormwork, setIncludeFormwork] = useState(true);

  const preview = useMemo(() => {
    const L = parseFloat(lengthFt);
    const W = parseFloat(widthFt);
    const T = parseFloat(thicknessIn);
    if (!(L > 0 && W > 0 && T > 0)) return null;
    try {
      return calculateConcrete({
        lengthFt: L,
        widthFt: W,
        thicknessIn: T,
        jobType,
        overagePct: parseFloat(overagePct) || 0,
        rebarSpacingIn: includeRebar ? parseFloat(rebarSpacingIn) || undefined : undefined,
        includeFormwork,
      });
    } catch {
      return null;
    }
  }, [lengthFt, widthFt, thicknessIn, jobType, overagePct, rebarSpacingIn, includeRebar, includeFormwork]);

  const apply = () => {
    if (!preview) {
      toast.error("Enter length, width, and thickness greater than zero");
      return;
    }
    const typeLabel =
      jobType === "footing" ? "Footing" : jobType === "wall" ? "Wall" : "Slab";
    const title = `${typeLabel} ${lengthFt}' × ${widthFt}' × ${thicknessIn}"`;
    const items = preview.lines.map((line: ConcreteCalcLine) => ({
      description: line.description,
      quantity: line.quantity,
      unit_price: 0,
    }));
    onApply({ title, notes: preview.notes, items });
    toast.success("Concrete quantities loaded — fill in your unit prices");
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Calculator className="h-4 w-4" />
        Concrete quantity calculator
      </div>
      <p className="text-xs text-muted-foreground">
        Enter dimensions to get yards, rebar, and formwork. Prices stay at $0 — use your rate book.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <Label className="text-xs">Length (ft)</Label>
          <Input
            type="number"
            min={0}
            step="0.1"
            value={lengthFt}
            onChange={(e) => setLengthFt(e.target.value)}
            placeholder="20"
          />
        </div>
        <div>
          <Label className="text-xs">Width (ft)</Label>
          <Input
            type="number"
            min={0}
            step="0.1"
            value={widthFt}
            onChange={(e) => setWidthFt(e.target.value)}
            placeholder="12"
          />
        </div>
        <div>
          <Label className="text-xs">Thickness (in)</Label>
          <Input
            type="number"
            min={0}
            step="0.5"
            value={thicknessIn}
            onChange={(e) => setThicknessIn(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={jobType} onValueChange={(v) => setJobType(v as ConcreteJobType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="slab">Slab / patio</SelectItem>
              <SelectItem value="footing">Footing</SelectItem>
              <SelectItem value="wall">Wall</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <Label className="text-xs">Overage %</Label>
          <Input
            type="number"
            min={0}
            step="1"
            value={overagePct}
            onChange={(e) => setOveragePct(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Rebar spacing (in)</Label>
          <Input
            type="number"
            min={0}
            step="1"
            value={rebarSpacingIn}
            onChange={(e) => setRebarSpacingIn(e.target.value)}
            disabled={!includeRebar}
          />
        </div>
        <div className="flex items-end gap-2 pb-2">
          <Checkbox
            id="cc-rebar"
            checked={includeRebar}
            onCheckedChange={(c) => setIncludeRebar(!!c)}
          />
          <Label htmlFor="cc-rebar" className="text-xs font-normal">Include rebar</Label>
        </div>
        <div className="flex items-end gap-2 pb-2">
          <Checkbox
            id="cc-forms"
            checked={includeFormwork}
            onCheckedChange={(c) => setIncludeFormwork(!!c)}
          />
          <Label htmlFor="cc-forms" className="text-xs font-normal">Include formwork</Label>
        </div>
      </div>

      {preview && (
        <div className="rounded-md border border-border bg-background p-2 text-xs space-y-1">
          <div className="font-medium">
            Order <span className="tabular-nums">{preview.yardsOrder} cy</span>
            <span className="text-muted-foreground font-normal">
              {" "}(net {preview.yardsRaw} cy · {preview.areaSqFt} sq ft)
            </span>
          </div>
          {preview.rebarLf != null && (
            <div className="text-muted-foreground">Rebar ~{preview.rebarLf} LF</div>
          )}
          {preview.formworkLf != null && (
            <div className="text-muted-foreground">Formwork {preview.formworkLf} LF</div>
          )}
        </div>
      )}

      <Button type="button" size="sm" onClick={apply} disabled={!preview}>
        Load quantities into estimate
      </Button>
    </div>
  );
}
