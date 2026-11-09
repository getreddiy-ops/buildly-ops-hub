import { Children, Fragment, isValidElement, ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type NodeProps = { children?: ReactNode; label?: string; className?: string; "data-wizard-label"?: string };
type Step = { content: ReactNode; label: string };

function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isValidElement<NodeProps>(node)) return "";
  return Children.toArray(node.props.children).map(text).join(" ");
}

// Form layout groups are expanded; field components and rich editors stay intact.
function stepsFrom(children: ReactNode): Step[] {
  return Children.toArray(children).flatMap((node): Step[] => {
    if (!isValidElement<NodeProps>(node)) return [];
    if (node.type === Fragment) return stepsFrom(node.props.children);
    if (node.props["data-wizard-label"]) return [{ content: node, label: node.props["data-wizard-label"]! }];
    if (node.type === CardHeader || (typeof node.type === "string" && /^(h[1-6]|p)$/.test(node.type))) return [];
    if (node.type === Card || node.type === CardContent) return stepsFrom(node.props.children);
    if (node.props.label) return [{ content: node, label: node.props.label }];
    const parts = Children.toArray(node.props.children);
    const label = parts.find((part) => isValidElement(part) &&
      (part.type === Label || part.type === "label" || (part.type as { displayName?: string })?.displayName === "Label" ||
        (typeof part.type !== "string" && text(part) && (part.props as { htmlFor?: string }).htmlFor)));
    if (label) return [{ content: node, label: text(label) }];
    if (typeof node.type === "string" && /grid|space-y/.test(node.props.className || "")) {
      return stepsFrom(node.props.children);
    }
    return [{ content: node, label: "Details" }];
  });
}

/** One question at a time, retaining controlled fields and rich editor state. */
export function FormWizard({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const steps = stepsFrom(children);
  const [position, setPosition] = useState(0);
  const [summary, setSummary] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const step = Math.min(position, steps.length);
  const reviewing = step === steps.length;

  useEffect(() => {
    const panel = root.current?.querySelector<HTMLElement>(`[data-wizard-step="${step}"]`);
    const controls = panel?.querySelectorAll<HTMLElement>('input:not([type="hidden"]),textarea,button[role="combobox"],select');
    controls?.forEach((control) => {
      if (!control.getAttribute("aria-label") && !control.getAttribute("aria-labelledby") && !("labels" in control && (control as HTMLInputElement).labels?.length)) {
        control.setAttribute("aria-labelledby", `${id}-question-${step}`);
      }
    });
    (controls?.[0] || root.current?.querySelector<HTMLElement>("[data-review-title]"))?.focus();
  }, [step, id]);

  const next = () => {
    const panel = root.current?.querySelector(`[data-wizard-step="${step}"]`);
    const fields = panel?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select");
    for (const field of fields || []) {
      if (!field.checkValidity()) { field.reportValidity(); return; }
    }
    const summaries = steps.map((_, index) => {
      const area = root.current?.querySelector(`[data-wizard-step="${index}"]`);
      const values = Array.from(area?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>('input:not([type="hidden"]),textarea,select,button[role="combobox"],[role="tab"][aria-selected="true"],[role="checkbox"],button[aria-pressed="true"]') || [])
        .map((field) => ["combobox", "tab"].includes(field.getAttribute("role") || "") || field.getAttribute("aria-pressed") === "true" ? field.textContent : field.getAttribute("role") === "checkbox" ? (field.getAttribute("aria-checked") === "true" ? "Yes" : "No") : field instanceof HTMLInputElement && field.type === "checkbox" ? (field.checked ? "Yes" : "No") : field.value)
        .filter(Boolean);
      return values.join(" · ") || (area?.querySelector("input,textarea,select,[role='combobox']") ? "Not provided" : area?.textContent?.replace(steps[index].label, "").trim()) || "Not provided";
    });
    setSummary(summaries);
    setPosition(step + 1);
  };

  return <div ref={root} className="grid min-w-0 gap-5" onKeyDown={(event) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing && event.target instanceof HTMLInputElement && event.target.type !== "file") {
      event.preventDefault();
      if (!reviewing) next();
    }
  }}>
    <div aria-live="polite" className="text-sm text-muted-foreground">
      {reviewing ? "Review before saving" : `Step ${step + 1} of ${steps.length}`}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Form progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={step}>
        <div className="h-full bg-primary transition-all" style={{ width: `${(step / Math.max(steps.length, 1)) * 100}%` }} />
      </div>
    </div>
    {steps.map((item, index) => <div key={index} hidden={reviewing || index !== step} data-wizard-step={index}>
      <h2 id={`${id}-question-${index}`} className="mb-4 text-xl font-semibold">{item.label}</h2>
      <div className="max-h-[50vh] overflow-y-auto p-1 [&>div>label:first-child]:sr-only">{item.content}</div>
    </div>)}
    {reviewing && <div className="max-h-[50vh] overflow-y-auto">
      <h2 data-review-title tabIndex={-1} className="mb-3 text-xl font-semibold">Does everything look right?</h2>
      <dl className="space-y-3">{steps.map((item, index) => <div key={index} className="flex items-start justify-between gap-3 rounded-lg border p-3">
        <div className="min-w-0"><dt className="text-sm font-medium">{item.label}</dt><dd className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{summary[index]}</dd></div>
        <Button type="button" variant="ghost" size="sm" aria-label={`Edit ${item.label}`} onClick={() => setPosition(index)}>Edit</Button>
      </div>)}</dl>
    </div>}
    <div className="flex items-center justify-between gap-3">
      <Button type="button" variant="outline" disabled={step === 0} onClick={() => setPosition(Math.max(0, step - 1))}>Back</Button>
      {!reviewing && <Button type="button" onClick={next}>{step === steps.length - 1 ? "Review" : "Next"}</Button>}
    </div>
    {reviewing && footer}
  </div>;
}
