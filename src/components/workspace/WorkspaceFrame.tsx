import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, FolderOpen, Menu, Sparkles, LogOut } from "lucide-react";
import { workspaceGroups, activeWorkspaceGroup } from "./navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { children: ReactNode; path: string; name: string; company: string; preview?: boolean; onSignOut?: () => void; admin?: boolean };
export function WorkspaceFrame({ children, path, name, company, preview = false, onSignOut, admin }: Props) {
  const [open, setOpen] = useState(false);
  const group = activeWorkspaceGroup(path);
  const href = (to: string) => preview ? `/workspace-preview?section=${encodeURIComponent(to)}` : to;
  const navigation = <nav aria-label="Workspace" className="space-y-1.5">
    {workspaceGroups.map((g) => <div key={g.label}>
      <Link to={href(g.to)} onClick={() => setOpen(false)} aria-current={group.label === g.label ? "page" : undefined} className={cn("flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors", group.label === g.label ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
        <g.icon className="h-[18px] w-[18px]" /><span className="flex-1">{g.label}</span>{group.label === g.label ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5 opacity-40" />}
      </Link>
      {group.label === g.label && <div className="ml-5 mt-1 space-y-1 border-l border-border pl-4 pb-3">{g.items.map(item => <Link key={item.to} to={href(item.to)} onClick={() => setOpen(false)} className={cn("block rounded-md px-2 py-2 text-xs transition-colors", path === item.to ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground")}>{item.label}</Link>)}</div>}
    </div>)}
  </nav>;
  return <div className="dark workspace-theme min-h-screen bg-background text-foreground">
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[246px] shrink-0 flex-col border-r border-border bg-card/40 px-4 md:flex">
        <Link to={href("/app")} className="flex h-20 items-center gap-2.5 px-2 text-xl font-semibold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><FolderOpen className="h-5 w-5" /></span>FastTract<span className="text-primary">.</span></Link>
        <div className="mb-6 rounded-xl border border-border bg-background/60 p-3"><p className="mb-1 text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">Workspace</p><p className="truncate text-sm font-medium">{company}</p></div>
        <div className="min-h-0 flex-1 overflow-y-auto">{navigation}<div className="mt-6 border-t border-border pt-4"><Link to={href("/app/assistant")} className="flex min-h-11 items-center gap-3 px-3 text-sm text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" /> Ask AI</Link>{admin && <><Link to="/admin" className="block px-3 py-2 text-xs text-muted-foreground">Platform admin</Link><Link to="/app/developer" className="block px-3 py-2 text-xs text-muted-foreground">Developer</Link></>}</div></div>
        <div className="mt-4 flex items-center gap-3 border-t border-border py-5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">{name.slice(0,2).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{name}</p><p className="text-[11px] text-muted-foreground">{preview ? "Preview workspace" : "Your workspace"}</p></div>{onSignOut && <button onClick={onSignOut} aria-label="Sign out" className="p-2 text-muted-foreground"><LogOut className="h-4 w-4" /></button>}</div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-8">
          <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></Button></SheetTrigger><SheetContent side="left" className="dark workspace-theme w-[min(320px,90vw)] overflow-y-auto bg-background"><SheetHeader className="mb-6"><SheetTitle>FastTract workspace</SheetTitle></SheetHeader>{navigation}{onSignOut && <Button variant="ghost" onClick={onSignOut} className="mt-6">Sign out</Button>}</SheetContent></Sheet>
          <span className="hidden text-xs text-muted-foreground sm:inline">Workspace</span><ChevronRight className="hidden h-3 w-3 text-muted-foreground sm:block" /><span className="text-sm font-medium">{group.label}</span><span className="ml-auto rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{preview ? "Interactive preview · sample data" : company}</span>
        </header>
        <main className="mx-auto w-full max-w-[1440px] p-4 pb-28 sm:p-8 sm:pb-28 md:p-8 lg:p-10">{children}</main>
      </div>
    </div>
    <nav aria-label="Mobile workspace" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 px-1 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">{workspaceGroups.map(g => <Link key={g.label} to={href(g.to)} aria-current={group.label === g.label ? "page" : undefined} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px]", group.label === g.label ? "text-primary bg-primary/10" : "text-muted-foreground")}><g.icon className="h-5 w-5" />{g.label}</Link>)}</nav>
  </div>;
}
