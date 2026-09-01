import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  new: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  contacted: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  qualified: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  won: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  lost: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  viewed: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  accepted: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  declined: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  invoiced: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  payment_processing: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  partially_paid: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  paid: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  void: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
  overdue: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  rejected: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  scheduled: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  in_progress: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  on_hold: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize font-medium", styles[status] ?? "")}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
