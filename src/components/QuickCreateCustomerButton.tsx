import { addressFields, emptyAddressParts, formatAddress } from "@/components/AddressFields";
import { FormWizard } from "@/components/FormWizard";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { FastTractApi } from "@/lib/fasttractApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

type Props = {
  onCreated: (customer: { id: string; name: string }) => void;
  size?: "sm" | "default" | "icon";
  variant?: "outline" | "ghost" | "default" | "secondary";
  label?: string;
};

/** Shared customer creation flow used by Jobs, Estimates, Invoices, and Contracts. */
export function QuickCreateCustomerButton({
  onCreated,
  size = "sm",
  variant = "outline",
  label = "New customer",
}: Props) {
  const { activeOrg } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const empty = { ...emptyAddressParts, firstName: "", lastName: "", middleName: "", email: "", phone: "", address: "" };
  const [form, setForm] = useState(empty);

  const reset = () => setForm(empty);

  const save = async () => {
    if (!activeOrg) return;
    const name = [form.firstName, form.middleName, form.lastName].map((part) => part.trim()).filter(Boolean).join(" ");
    if (!name) return toast.error("Name is required");
    if (name.length > 120) return toast.error("Full name must be at most 120 characters");

    setSaving(true);
    try {
      const result = await FastTractApi.createCustomer(activeOrg.organization_id, {
        name,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: formatAddress(form) || null,
      }) as { data?: { id: string; name: string } };
      if (!result.data) throw new Error("FastTract did not return the new customer.");
      toast.success("Customer created");
      onCreated(result.data);
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button type="button" size={size} variant={variant}>
          <UserPlus className="h-4 w-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New customer</DialogTitle></DialogHeader>
<FormWizard footer={<DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create customer"}</Button>
        </DialogFooter>}>

        <div className="grid gap-3">
          <Row label="First name"><Input required maxLength={120} autoComplete="given-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Row>
          <Row label="Last name (optional)"><Input maxLength={120} autoComplete="family-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Row>
          <Row label="Middle name (optional)"><Input maxLength={120} autoComplete="additional-name" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} /></Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Row>
            <Row label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Row>
          </div>
          {addressFields(form, (parts) => setForm({ ...form, ...parts }))}
        </div>

</FormWizard>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
