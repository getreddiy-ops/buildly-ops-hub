import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { DocumentPreview } from "@/components/DocumentPreview";
import { useBranding } from "@/hooks/useBranding";
import { SendDocumentDialog } from "@/components/SendDocumentDialog";
import { ArrowLeft, Send, Pencil, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { generateDocumentPdf } from "@/lib/generateDocumentPdf";

type Row = any;

export default function EstimateDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { branding } = useBranding();
  const [est, setEst] = useState<Row | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: e, error }, { data: li }] = await Promise.all([
      supabase.from("estimates").select("*, customers(name,email,phone,address)").eq("id", id).maybeSingle(),
      supabase.from("estimate_line_items").select("*").eq("estimate_id", id).order("position"),
    ]);
    if (error) toast.error(error.message);
    setEst(e);
    setItems(li ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const remove = async () => {
    if (!est || !confirm("Delete this estimate?")) return;
    const { error } = await supabase.from("estimates").delete().eq("id", est.id);
    if (error) return toast.error(error.message);
    toast.success("Estimate deleted");
    nav("/app/estimates");
  };

  const downloadPdf = () => {
    if (!est) return;
    try {
      const { blob, filename } = generateDocumentPdf(
        {
          doc_type: "estimate",
          title: est.title,
          recipient: {
            name: est.customers?.name,
            address: est.customers?.address,
            email: est.customers?.email,
            phone: est.customers?.phone,
          },
          line_items: items.map((i) => ({
            description: i.description,
            quantity: Number(i.quantity),
            unit_price: Number(i.unit_price),
          })),
          tax_rate: Number(est.subtotal) > 0 ? (Number(est.tax) / Number(est.subtotal)) * 100 : 0,
          terms: est.notes ?? undefined,
        },
        {
          name: branding?.name ?? undefined,
          address: branding?.address ?? undefined,
          phone: branding?.phone ?? undefined,
          email: branding?.email ?? undefined,
          website: branding?.website ?? undefined,
        },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to generate PDF");
    }
  };


  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!est) return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => nav("/app/estimates")}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <div className="text-sm text-muted-foreground">Estimate not found.</div>
    </div>
  );

  return (
    <div>
      <div className="mb-3">
        <Button variant="ghost" size="sm" onClick={() => nav("/app/estimates")}>
          <ArrowLeft className="h-4 w-4" /> All estimates
        </Button>
      </div>
      <PageHeader
        title={est.title}
        description={<div className="flex items-center gap-2"><StatusBadge status={est.status} /><span className="text-xs text-muted-foreground">#{est.id.slice(0, 8).toUpperCase()}</span></div>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadPdf}><Download className="h-4 w-4" /> PDF</Button>
            <Button variant="outline" onClick={() => nav(`/app/estimates?edit=${est.id}`)}><Pencil className="h-4 w-4" /> Edit</Button>
            <Button variant="outline" className="text-destructive" onClick={remove}><Trash2 className="h-4 w-4" /> Delete</Button>
            <Button onClick={() => setSendOpen(true)}><Send className="h-4 w-4" /> Send</Button>
          </div>
        }
      />

      <div className="rounded-lg border border-border bg-card p-4 md:p-6">
        <DocumentPreview
          branding={branding}
          type="estimate"
          documentNumber={est.id.slice(0, 8).toUpperCase()}
          customerName={est.customers?.name}
          customerAddress={est.customers?.address}
          issueDate={est.created_at}
          lineItems={items.map((i) => ({
            description: i.description,
            quantity: Number(i.quantity),
            unit_price: Number(i.unit_price),
            total: Number(i.total),
          }))}
          subtotal={Number(est.subtotal)}
          taxAmount={Number(est.tax)}
          total={Number(est.total)}
        />
        {est.notes && (
          <div className="mt-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Notes</div>
            <p className="text-sm whitespace-pre-wrap">{est.notes}</p>
          </div>
        )}
      </div>

      <SendDocumentDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        docType="estimate"
        docId={est.id}
        defaultEmail={est.customers?.email}
        defaultPhone={est.customers?.phone}
        customerName={est.customers?.name}
        onSent={() => setSendOpen(false)}
      />
    </div>
  );
}
