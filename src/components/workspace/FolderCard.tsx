import { Folder, ArrowUpRight, MapPin, CalendarDays } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
export type FolderJob = { id: string; title: string; status: string; address: string | null; scheduled_start: string | null; budget: number | null; customers?: { name: string } | null };
export function FolderCard({ job, onOpen }: { job: FolderJob; onOpen: () => void }) {
  return <button onClick={onOpen} className="workspace-folder group min-w-0 rounded-2xl border border-border bg-card p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
    <div className="mb-6 flex items-center justify-between gap-2"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Folder className="h-6 w-6" /></span><StatusBadge status={job.status} /></div>
    <p className="mb-1 truncate text-[11px] uppercase tracking-wider text-muted-foreground">{job.customers?.name || "Customer not assigned"}</p>
    <h3 className="mb-4 truncate text-base font-semibold">{job.title}</h3>
    <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{job.address || "Address not set"}</span></p>
    <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4"><span className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{job.scheduled_start ? new Date(job.scheduled_start).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Unscheduled"}</span><span className="flex items-center gap-1 text-xs font-medium text-primary">Open folder <ArrowUpRight className="h-3.5 w-3.5" /></span></div>
  </button>;
}
