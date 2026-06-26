import { Branding, DocumentTemplate } from "@/hooks/useBranding";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Props {
  branding: Branding | null;
  type: "estimate" | "invoice" | "contract";
  documentNumber?: string;
  customerName?: string;
  customerAddress?: string;
  issueDate?: string;
  dueDate?: string;
  lineItems?: LineItem[];
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  total?: number;
  template?: DocumentTemplate;
  body?: string; // for contracts
}

const money = (n?: number) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, { style: "currency", currency: "USD" })
    : "—";

export function DocumentPreview({
  branding,
  type,
  documentNumber,
  customerName,
  customerAddress,
  issueDate,
  dueDate,
  lineItems = [],
  subtotal,
  taxRate,
  taxAmount,
  total,
  template,
  body,
}: Props) {
  const color = branding?.brand_color ?? "#3b82f6";
  const label = type === "invoice" ? "INVOICE" : type === "contract" ? "CONTRACT" : "ESTIMATE";

  return (
    <div
      className="mx-auto max-w-3xl rounded-md bg-white p-10 text-slate-900 shadow-lg print:shadow-none"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div
        className="mb-8 flex items-start justify-between border-b-4 pb-6"
        style={{ borderColor: color }}
      >
        <div>
          {branding?.logo_signed_url ? (
            <img
              src={branding.logo_signed_url}
              alt={branding.name}
              className="mb-3 max-h-16 max-w-[220px] object-contain"
            />
          ) : (
            <div className="text-2xl font-bold" style={{ color }}>
              {branding?.name ?? "Your Company"}
            </div>
          )}
          <div className="text-xs leading-snug text-slate-600">
            {branding?.legal_name && <div>{branding.legal_name}</div>}
            {branding?.address && <div className="whitespace-pre-line">{branding.address}</div>}
            {branding?.phone && <div>{branding.phone}</div>}
            {branding?.email && <div>{branding.email}</div>}
            {branding?.website && <div>{branding.website}</div>}
            {branding?.tax_id && <div>Tax ID: {branding.tax_id}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-extrabold tracking-tight" style={{ color }}>
            {label}
          </div>
          {documentNumber && (
            <div className="mt-1 text-sm text-slate-600">#{documentNumber}</div>
          )}
          {issueDate && (
            <div className="mt-1 text-xs text-slate-500">Issued {issueDate}</div>
          )}
          {dueDate && <div className="text-xs text-slate-500">Due {dueDate}</div>}
        </div>
      </div>

      {template?.header && (
        <div className="mb-6 whitespace-pre-line text-sm text-slate-700">{template.header}</div>
      )}

      {(customerName || customerAddress) && (
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Bill to
          </div>
          <div className="mt-1 text-sm font-medium">{customerName}</div>
          {customerAddress && (
            <div className="whitespace-pre-line text-xs text-slate-600">{customerAddress}</div>
          )}
        </div>
      )}

      {type !== "contract" && lineItems.length > 0 && (
        <table className="mb-6 w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: color, color: "white" }}>
              <th className="px-3 py-2 text-left font-semibold">Description</th>
              <th className="w-20 px-3 py-2 text-right font-semibold">Qty</th>
              <th className="w-28 px-3 py-2 text-right font-semibold">Rate</th>
              <th className="w-28 px-3 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-3 py-2">{li.description}</td>
                <td className="px-3 py-2 text-right">{li.quantity}</td>
                <td className="px-3 py-2 text-right">{money(li.unit_price)}</td>
                <td className="px-3 py-2 text-right">{money(li.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {type !== "contract" && (
        <div className="mb-6 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            {!!taxRate && (
              <div className="flex justify-between">
                <span className="text-slate-600">Tax ({taxRate}%)</span>
                <span>{money(taxAmount)}</span>
              </div>
            )}
            <div
              className="mt-2 flex justify-between border-t-2 pt-2 text-base font-bold"
              style={{ borderColor: color, color }}
            >
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
          </div>
        </div>
      )}

      {type === "contract" && body && (
        <div className="mb-6 whitespace-pre-line text-sm leading-relaxed text-slate-800">
          {body}
        </div>
      )}

      {template?.notes && (
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</div>
          <div className="mt-1 whitespace-pre-line text-sm text-slate-700">{template.notes}</div>
        </div>
      )}

      {template?.terms && (
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Terms &amp; Conditions
          </div>
          <div className="mt-1 whitespace-pre-line text-xs text-slate-600">{template.terms}</div>
        </div>
      )}

      {template?.footer && (
        <div
          className="mt-8 border-t pt-4 text-center text-xs text-slate-500"
          style={{ borderColor: color }}
        >
          {template.footer}
        </div>
      )}
    </div>
  );
}
