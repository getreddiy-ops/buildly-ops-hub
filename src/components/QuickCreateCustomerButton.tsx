import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

/**
 * Small reusable "Add customer" button + dialog for pages that build on top
 * of an existing customer (Estimates, Invoices, Contracts, Jobs, etc.).
 * Inserts into `customers` for the active org and returns the new row to the
 * parent so it can refresh its list and auto-select the new customer.
 */
export function QuickCreateCustomerButton({
  onCreated,
  size = "sm",
  variant = "outline",
  label = "New customer",
}: Props) {
  const { activeOrg } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });

  const reset = () => setForm({ name: "", email: "", phone: "", address: "" });

  const save = async () => {
    if (!activeOrg) return;
    const name = form.name.trim();
    if (!name) return toast.error("Name is required");
    setSaving(true);
    const { data, error } = await supabase
      .from("customers")
      .insert({
        organization_id: activeOrg.organization_id,
        name,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      })
      .select("id,name")
      .single();
    setSaving(false);
    if (error || !data) return toast.error(error?.message ?? "Could not create customer");
    toast.success("Customer created");
    onCreated(data);
    reset();
    setOpen(false);
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
        <div className="grid gap-3">
          <Row label="Name">
            <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Row>
            <Row label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Row>
          </div>
          <Row label="Address">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Row>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create customer"}</Button>
        </DialogFooter>
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
