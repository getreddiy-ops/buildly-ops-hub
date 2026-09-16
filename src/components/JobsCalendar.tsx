import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Job = Database["public"]["Tables"]["jobs"]["Row"] & { customers?: { name: string } | null };

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function JobsCalendar({ jobs, onSelectJob }: { jobs: Job[]; onSelectJob: (job: Job) => void }) {
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const jobsByDay = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const job of jobs) {
      if (!job.scheduled_start) continue;
      const key = dateKey(new Date(job.scheduled_start));
      const list = map.get(key) ?? [];
      list.push(job);
      map.set(key, list);
    }
    return map;
  }, [jobs]);

  const weeks = useMemo(() => {
    const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - startOffset);

    const days: Date[] = [];
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [anchor]);

  const monthLabel = anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = dateKey(new Date());

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border p-3">
        <h3 className="text-sm font-semibold">{monthLabel}</h3>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { const d = new Date(); d.setDate(1); setAnchor(d); }}>Today</Button>
          <Button size="icon" variant="ghost" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="divide-y divide-border">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x divide-border">
            {week.map((day) => {
              const key = dateKey(day);
              const dayJobs = jobsByDay.get(key) ?? [];
              const inMonth = day.getMonth() === anchor.getMonth();
              return (
                <div key={key} className={cn("min-h-24 p-1.5", !inMonth && "bg-muted/20")}>
                  <div className={cn(
                    "mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs",
                    key === today ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    !inMonth && "opacity-40",
                  )}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayJobs.slice(0, 3).map((job) => (
                      <button
                        key={job.id}
                        onClick={() => onSelectJob(job)}
                        className="block w-full truncate rounded bg-primary/10 px-1.5 py-0.5 text-left text-xs text-primary hover:bg-primary/20"
                        title={job.title}
                      >
                        {job.title}
                      </button>
                    ))}
                    {dayJobs.length > 3 && (
                      <div className="px-1.5 text-[10px] text-muted-foreground">+{dayJobs.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
