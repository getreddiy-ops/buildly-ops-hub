import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type InvoiceLine = { id?: string; description: string; category: string; unit: string; quantity: number; unit_price: number };
export type SavedInvoiceItem = InvoiceLine & { id: string };
export const blankInvoiceLine = (): InvoiceLine => ({ description: "", category: "Labor", unit: "ea", quantity: 1, unit_price: 0 });
const defaultCategories = ["Labor", "Materials", "Equipment", "Subcontractors", "Other"];
const money = (value: number) => value.toLocaleString(undefined, { style: "currency", currency: "USD" });

export function InvoiceLineEditor({ items, onChange, catalog, onSaveItem, savingItem, catalogLoading = false }: {
  items: InvoiceLine[];
  onChange: (items: InvoiceLine[]) => void;
  catalog: SavedInvoiceItem[];
  onSaveItem: (item: InvoiceLine) => Promise<unknown>;
  savingItem: boolean;
  catalogLoading?: boolean;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const categories = [...new Set([...defaultCategories, ...catalog.map(item => item.category), ...items.map(item => item.category)].filter(Boolean))];
  const matches = catalog.filter(item => `${item.category} ${item.description} ${item.unit}`.toLowerCase().includes(search.toLowerCase()));
  const update = (index: number, patch: Partial<InvoiceLine>) => onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  const addSaved = (saved: SavedInvoiceItem) => {
    // Invoice rows are independent snapshots: changing a library price never changes an existing invoice.
    const { id: _id, ...line } = saved;
    const emptyIndex = items.findIndex(item => !item.description.trim());
    onChange(emptyIndex < 0 ? [...items, line] : items.map((item, i) => i === emptyIndex ? line : item));
  };
  return <section className="space-y-4" aria-label="Invoice line items">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">Line items</h2>
      <Button type="button" variant="outline" onClick={() => onChange([...items, blankInvoiceLine()])}>Add line item</Button>
    </div>
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">Saved item library ({catalog.length})</summary>
      <Label htmlFor={`${id}-search`} className="mt-3 block">Search by item or category</Label>
      <Input id={`${id}-search`} className="mt-1" value={search} onChange={e => setSearch(e.target.value)} placeholder="Labor, concrete, pump…" />
      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
        {catalogLoading ? <p className="text-sm text-muted-foreground">Loading saved items…</p> : matches.length === 0 ? <p className="text-sm text-muted-foreground">{catalog.length ? "No matching items." : "Save a line below to reuse it on future invoices."}</p> : matches.map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded border p-2">
          <div className="min-w-0 text-sm"><p className="font-medium">{item.description}</p><p className="text-muted-foreground">{item.category} · {money(item.unit_price)} / {item.unit}</p></div>
          <Button type="button" size="sm" variant="outline" aria-label={`Add ${item.description}`} onClick={() => addSaved(item)}>Add</Button>
        </div>)}
      </div>
    </details>
    <datalist id={`${id}-categories`}>{categories.map(category => <option key={category} value={category} />)}</datalist>
    {items.map((item, index) => <fieldset key={index} className="space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">Item {index + 1}</legend>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor={`${id}-${index}-category`}>Category</Label><Input id={`${id}-${index}-category`} list={`${id}-categories`} value={item.category} onChange={e => update(index, { category: e.target.value })} /></div>
        <div><Label htmlFor={`${id}-${index}-unit`}>Unit</Label><Input id={`${id}-${index}-unit`} value={item.unit} onChange={e => update(index, { unit: e.target.value })} placeholder="hr, CY, SF, ea" /></div>
      </div>
      <div><Label htmlFor={`${id}-${index}-description`}>Description</Label><Input id={`${id}-${index}-description`} value={item.description} onChange={e => update(index, { description: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor={`${id}-${index}-quantity`}>Quantity</Label><Input id={`${id}-${index}-quantity`} type="number" min="0" step="any" value={item.quantity} onChange={e => update(index, { quantity: Number(e.target.value) })} /></div>
        <div><Label htmlFor={`${id}-${index}-price`}>Unit price (USD)</Label><Input id={`${id}-${index}-price`} type="number" min="0" step="0.01" value={item.unit_price} onChange={e => update(index, { unit_price: Number(e.target.value) })} /></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Line total: {money(item.quantity * item.unit_price)}</span>
        <div className="flex gap-1"><Button type="button" size="sm" variant="outline" disabled={savingItem || !item.description.trim()} onClick={() => void onSaveItem(item)}>Save to library</Button><Button type="button" size="sm" variant="ghost" aria-label={`Remove item ${index + 1}`} onClick={() => onChange(items.filter((_, i) => i !== index))}>Remove</Button></div>
      </div>
    </fieldset>)}
  </section>;
}
