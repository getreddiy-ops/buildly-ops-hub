import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  highLevel,
  type HighLevelInvoice,
  type HighLevelInvoicePaymentMode,
} from "@/integrations/highlevel/client";
import {
  invoiceAmountDue,
  invoiceCustomer,
  invoiceLabel,
} from "@/lib/highlevelMoney";
import { toast } from "sonner";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const paymentModes: Array<{ value: HighLevelInvoicePaymentMode; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card received outside FastTract" },
  { value: "cheque", label: "Check / cheque" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
];

function localDateValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function RecordPaymentDialog({
  invoice,
  open,
  onOpenChange,
  onRecorded,
}: {
  invoice: HighLevelInvoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded: () => void | Promise<void>;
}) {
  const balance = useMemo(() => invoice ? invoiceAmountDue(invoice) : 0, [invoice]);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<HighLevelInvoicePaymentMode>("cash");
  const [fulfilledDate, setFulfilledDate] = useState(localDateValue());
  const [notes, setNotes] = useState("");
  const [cardBrand, setCardBrand] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !invoice) return;
    setAmount(balance.toFixed(2));
    setMode("cash");
    setFulfilledDate(localDateValue());
    setNotes("");
    setCardBrand("");
    setCardLast4("");
    setChequeNumber("");
  }, [balance, invoice, open]);

  const recordPayment = async () => {
    if (!invoice) return;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Enter a payment amount greater than zero");
      return;
    }
    if (numericAmount > balance + 0.009) {
      toast.error(`Payment cannot exceed the open balance of ${money.format(balance)}`);
      return;
    }
    if (!fulfilledDate) {
      toast.error("Choose the date the payment was received");
      return;
    }
    if (mode === "card" && cardLast4.replace(/\D/g, "").length !== 4) {
      toast.error("Enter the last four digits of the card");
      return;
    }
    if (mode === "cheque" && !chequeNumber.trim()) {
      toast.error("Enter the check or cheque number");
      return;
    }

    const paymentDate = new Date(`${fulfilledDate}T12:00:00`);
    if (Number.isNaN(paymentDate.getTime())) {
      toast.error("Payment date is invalid");
      return;
    }

    setSaving(true);
    try {
      await highLevel.recordInvoicePayment(invoice._id, {
        amount: numericAmount,
        mode,
        notes: notes.trim() || `Payment recorded for ${invoiceLabel(invoice)}`,
        fulfilledAt: paymentDate.toISOString(),
        cardBrand: mode === "card" ? cardBrand.trim() || "card" : undefined,
        cardLast4: mode === "card" ? cardLast4.replace(/\D/g, "") : undefined,
        chequeNumber: mode === "cheque" ? chequeNumber.trim() : undefined,
      });
      toast.success("Payment recorded in HighLevel", {
        description: `${money.format(numericAmount)} received from ${invoiceCustomer(invoice)}.`,
      });
      onOpenChange(false);
      await onRecorded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record the payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-8">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Record payment</DialogTitle>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {invoice ? `${invoiceLabel(invoice)} · ${invoiceCustomer(invoice)}` : "Invoice"}
              </p>
            </div>
          </div>
        </DialogHeader>

        {invoice && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card/40 p-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Open balance</p>
                <p className="mt-1 text-lg font-semibold">{money.format(balance)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recording</p>
                <p className="mt-1 text-lg font-semibold">{money.format(Math.max(0, Number(amount) || 0))}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount received">
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max={balance}
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </Field>
              <Field label="Date received">
                <Input
                  type="date"
                  max={localDateValue()}
                  value={fulfilledDate}
                  onChange={(event) => setFulfilledDate(event.target.value)}
                />
              </Field>
            </div>

            <Field label="Payment method">
              <Select value={mode} onValueChange={(value) => setMode(value as HighLevelInvoicePaymentMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentModes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            {mode === "card" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Card brand">
                  <Input value={cardBrand} onChange={(event) => setCardBrand(event.target.value)} placeholder="Visa, Mastercard…" />
                </Field>
                <Field label="Last four digits">
                  <Input
                    inputMode="numeric"
                    maxLength={4}
                    value={cardLast4}
                    onChange={(event) => setCardLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="1234"
                  />
                </Field>
              </div>
            )}

            {mode === "cheque" && (
              <Field label="Check / cheque number">
                <Input value={chequeNumber} onChange={(event) => setChequeNumber(event.target.value)} />
              </Field>
            )}

            <Field label="Payment note">
              <Textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Deposit, final payment, check received on site…"
              />
            </Field>

            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              This records a payment against the native HighLevel invoice. Use it only after the funds were actually received.
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void recordPayment()} disabled={saving || !invoice || balance <= 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />}
            {saving ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
