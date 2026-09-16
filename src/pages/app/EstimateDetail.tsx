import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { DocumentPreview } from "@/components/DocumentPreview";
import { useBranding } from "@/hooks/useBranding";
import { SendDocumentDialog } from "@/components/SendDocumentDialog";
import { ArrowLeft, Send, Pencil, Trash2, Download, Briefcase, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { generateDocumentPdf } from "@/lib/generateDocumentPdf";
import { useAuth } from "@/contexts/AuthContext";

type Row = any;

export default function EstimateDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { activeOrg, user } = useAuth();
  const { branding } = useBranding();
  const [est, setEst] = useState<Row | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [linkedJobId, setLinkedJobId] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: e, error }, { data: li }, { data: job }] = await Promise.all([
      supabase.from("estimates").select("*, customers(name,email,phone,address)").eq("id", id).maybeSingle(),
      supabase.from("estimate_line_items").select("*").eq("estimate_id", id).order("position"),
      supabase.from("jobs").select("id").eq("estimate_id", id).maybeSingle(),
    ]);
    if (error) toast.error(error.message);
    setEst(e);
    setItems(li ?? []);
    setLinkedJobId(job?.id ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const convertToJob = async () => {
    if (!est || !activeOrg || !user) return;
    setConverting(true);
    const { data: job, error } = await supabase.from("jobs").insert({
      organization_id: activeOrg.organization_id,
      customer_id: est.customer_id,
      estimate_id: est.id,
      title: est.title,
      budget: Number(est.total),
      status: "scheduled",
      created_by: user.id,
    }).select("id").single();
    setConverting(false);
    if (error) return toast.error(error.message);
    setLinkedJobId(job.id);
    toast.success("Job created from this estimate");
    nav("/app/jobs");
  };

  const copyShareLink = () => {
    if (!est?.share_token) return;
    const url = `${window.location.origin}/e/${est.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Customer link copied");
  };

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
        description={`Estimate #${est.id.slice(0, 8).toUpperCase()}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {est.share_token && <Button variant="outline" onClick={copyShareLink}><Copy className="h-4 w-4" /> Copy customer link</Button>}
            <Button variant="outline" onClick={downloadPdf}><Download className="h-4 w-4" /> PDF</Button>
            <Button variant="outline" onClick={() => nav(`/app/estimates?edit=${est.id}`)}><Pencil className="h-4 w-4" /> Edit</Button>
            <Button variant="outline" className="text-destructive" onClick={remove}><Trash2 className="h-4 w-4" /> Delete</Button>
            <Button onClick={() => setSendOpen(true)}><Send className="h-4 w-4" /> Send</Button>
          </div>
        }
      />
      <div className="mb-4 flex items-center gap-3"><StatusBadge status={est.status} /></div>

      {est.status === "approved" && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Accepted{est.accepted_by_name ? ` by ${est.accepted_by_name}` : ""}
              {est.accepted_at ? ` on ${new Date(est.accepted_at).toLocaleDateString()}` : ""}
            </span>
          </div>
          {linkedJobId ? (
            <Button size="sm" variant="outline" onClick={() => nav("/app/jobs")}><Briefcase className="h-4 w-4" /> View job</Button>
          ) : (
            <Button size="sm" onClick={convertToJob} disabled={converting}>
              <Briefcase className="h-4 w-4" /> {converting ? "Creating job…" : "Convert to job"}
            </Button>
          )}
        </div>
      )}


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
