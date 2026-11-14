import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { PlanTakeoff, SourceRef } from "../../../supabase/functions/_shared/takeoff-schema";

type Col = { key: string; label: string; type?: "num" | "text" };
type Section = "elements" | "rebar" | "anchorBolts" | "holdDowns" | "joints";

const SECTIONS: { key: Section; title: string; cols: Col[] }[] = [
  { key: "elements", title: "Concrete elements", cols: [
    { key: "id", label: "ID", type: "text" }, { key: "label", label: "Name", type: "text" }, { key: "kind", label: "Type" },
    { key: "lengthFt", label: "Length (ft)", type: "num" }, { key: "widthIn", label: "Width / thick (in)", type: "num" },
    { key: "depthIn", label: "Depth (in)", type: "num" }, { key: "heightIn", label: "Height (in)", type: "num" },
    { key: "count", label: "Count", type: "num" }, { key: "areaSqFt", label: "Area (sf)", type: "num" }, { key: "perimeterFt", label: "Edge (ft)", type: "num" },
    { key: "footingWidthIn", label: "Ftg width (in)", type: "num" },
  ] },
  { key: "rebar", title: "Rebar", cols: [
    { key: "id", label: "ID", type: "text" }, { key: "elementId", label: "Element", type: "text" }, { key: "barSize", label: "Bar" }, { key: "role", label: "Placement" },
    { key: "count", label: "Count", type: "num" }, { key: "spacingIn", label: "Spacing (in)", type: "num" }, { key: "lapIn", label: "Lap (in)", type: "num" },
    { key: "hookIn", label: "Hook (in)", type: "num" }, { key: "embedIn", label: "Embed (in)", type: "num" }, { key: "coverIn", label: "Cover (in)", type: "num" },
  ] },
  { key: "anchorBolts", title: "Anchor bolts", cols: [
    { key: "id", label: "ID", type: "text" }, { key: "elementId", label: "Element", type: "text" }, { key: "diameterIn", label: "Dia (in)", type: "num" },
    { key: "lengthIn", label: "Length (in)", type: "num" }, { key: "spacingIn", label: "Spacing (in)", type: "num" },
    { key: "endDistanceIn", label: "From ends (in)", type: "num" }, { key: "embedIn", label: "Embed (in)", type: "num" },
  ] },
  { key: "holdDowns", title: "Hold-downs", cols: [{ key: "model", label: "Model", type: "text" }, { key: "count", label: "Count", type: "num" }, { key: "location", label: "Location", type: "text" }] },
  { key: "joints", title: "Joints", cols: [{ key: "type", label: "Type" }, { key: "description", label: "As drawn", type: "text" }, { key: "spacingFt", label: "Spacing (ft)", type: "num" }] },
];

function sourceText(s: SourceRef) {
  return [s.sheet, s.detail].filter(Boolean).join(" · ") + (s.note ? ` — “${s.note}”` : "");
}

/** Every item the AI read, editable, with where it was read and how sure the reader was. */
export function TakeoffReview({ takeoff, onChange, readOnly }: { takeoff: PlanTakeoff; onChange: (t: PlanTakeoff) => void; readOnly?: boolean }) {
  const update = (section: Section, index: number, key: string, raw: string, type?: "num" | "text") => {
    const value = type === "num" ? (raw.trim() === "" ? null : Number(raw)) : raw;
    if (type === "num" && value !== null && !(Number(value) >= 0)) return;
    const list = [...(takeoff[section] as unknown as Record<string, unknown>[])];
    list[index] = { ...list[index], [key]: value, confidence: 1 }; // a person set it, so it is certain
    onChange({ ...takeoff, [section]: list } as PlanTakeoff);
  };
  const remove = (section: Section, index: number) => {
    const list = [...(takeoff[section] as unknown as unknown[])];
    list.splice(index, 1);
    onChange({ ...takeoff, [section]: list } as PlanTakeoff);
  };

  return <div className="space-y-8">
    {takeoff.missing.length > 0 && <section className="rounded-lg border border-orange-300 bg-orange-50 p-4 text-orange-950">
      <h3 className="font-semibold">Not on the plans: confirm with the engineer</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{takeoff.missing.map((m, i) => <li key={i}>{m.what}{m.elementId ? ` (${m.elementId})` : ""}</li>)}</ul>
    </section>}
    <p className="text-sm text-muted-foreground">Construction joints, per plans: {takeoff.constructionJointRule ? `“${takeoff.constructionJointRule}”` : "the drawings don't say. Proposed pour breaks are turned off."}</p>

    {SECTIONS.map(({ key, title, cols }) => {
      const rows = takeoff[key] as unknown as (Record<string, unknown> & { source: SourceRef; confidence: number })[];
      return <section key={key} className="space-y-2">
        <h3 className="text-lg font-semibold">{title} <span className="text-sm font-normal text-muted-foreground">({rows.length})</span></h3>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">None found on the selected sheets.</p> :
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr>
              {cols.map((c) => <th key={c.key} scope="col" className="px-2 py-2 font-medium">{c.label}</th>)}
              <th scope="col" className="px-2 py-2 font-medium">Read from</th><th scope="col" className="px-2 py-2"><span className="sr-only">Remove</span></th>
            </tr></thead>
            <tbody>{rows.map((row, i) => <tr key={i} className={row.confidence < 0.7 ? "bg-orange-50" : ""}>
              {cols.map((c) => <td key={c.key} className="px-2 py-1 align-top">
                {readOnly || !c.type ? <span className="whitespace-nowrap">{row[c.key] == null ? <span className="text-orange-800">not on plans</span> : String(row[c.key])}</span>
                  : <Input aria-label={`${title} ${i + 1} ${c.label}`} className="h-9 min-w-[7rem]" inputMode={c.type === "num" ? "decimal" : undefined}
                      defaultValue={row[c.key] == null ? "" : String(row[c.key])} placeholder={c.type === "num" ? "not on plans" : ""}
                      onBlur={(e) => update(key, i, c.key, e.target.value, c.type)} />}
              </td>)}
              <td className="px-2 py-1 align-top text-xs text-muted-foreground">
                {sourceText(row.source)}
                {row.confidence < 0.7 && <Badge variant="secondary" className="ml-2">check this</Badge>}
              </td>
              <td className="px-2 py-1 align-top">{!readOnly && <Button variant="ghost" size="icon" aria-label={`Remove ${title} ${i + 1}`} onClick={() => remove(key, i)}><Trash2 className="h-4 w-4" /></Button>}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>;
    })}
  </div>;
}
