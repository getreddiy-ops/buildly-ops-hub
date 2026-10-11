import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { workspaceGroups } from "@/components/workspace/navigation";
export default function WorkspaceHub({ section, preview = false }: { section: string; preview?: boolean }) {
  const group = workspaceGroups.find(g => g.label === section)!;
  return <div className="space-y-8"><div><p className="mb-3 text-xs uppercase tracking-[.2em] text-primary">Your workspace</p><h1 className="text-3xl font-semibold tracking-tight">{section}</h1><p className="mt-2 text-sm text-muted-foreground">{group.description}. Everything has a place.</p></div><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{group.items.map(item => <Link key={item.to} to={preview ? `/workspace-preview?section=${encodeURIComponent(item.to)}` : item.to} className="workspace-folder rounded-2xl border border-border bg-card p-6 transition hover:border-primary/60"><div className="mb-7 flex items-center justify-between"><item.icon className="h-7 w-7 text-primary" /><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></div><h2 className="font-semibold">{item.label}</h2><p className="mt-2 text-xs text-muted-foreground">Open {item.label.toLowerCase()}</p></Link>)}</div></div>;
}
