import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, PanelLeft, Search, Database, Table2, FileText, X, Settings, Sparkles, LogOut, Home, Users, FolderOpen, Receipt, CalendarDays, Building2 } from "lucide-react";
import { workspaceGroups } from "./navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import fasttractLogo from "@/assets/fasttract-logo.png";
import { WeatherBackdrop } from "./WeatherBackdrop";

type Props = { children: ReactNode; path: string; name: string; company: string; preview?: boolean; onSignOut?: () => void; admin?: boolean; weatherUserId?: string };
const objects = workspaceGroups.flatMap(group => group.items);
function documentName(path: string) {
  return objects.find(item => item.to === path)?.label || workspaceGroups.find(group => group.to === path)?.label || (path === "/app/assistant" ? "Ask AI" : path.startsWith("/app/jobs/") ? "Job details" : "Workspace");
}
const commands = {
  home: [
    { label: "Workspace", items: [["/app", "Overview", Home], ["/app/calendar", "Calendar", CalendarDays]] },
    { label: "Open records", items: [["/app/customers", "Customers", Users], ["/app/jobs", "Jobs", FolderOpen], ["/app/estimates", "Estimates", FileText], ["/app/invoices", "Invoices", Receipt]] },
    { label: "Assistant", items: [["/app/assistant", "Ask AI", Sparkles]] },
  ],
  records: [
    { label: "People", items: [["/app/customers", "Customers", Users], ["/app/leads", "Leads", Users], ["/app/vendors", "Vendors", Building2]] },
    { label: "Work", items: [["/app/jobs", "Jobs", FolderOpen], ["/app/materials", "Materials", Table2], ["/app/contracts", "Contracts", FileText]] },
    { label: "Documents", items: [["/app/estimates", "Estimates", FileText], ["/app/invoices", "Invoices", Receipt]] },
  ],
  company: [{ label: "Company setup", items: [["/app/business-profile", "Business profile", Building2], ["/app/branding", "Brand & documents", FileText], ["/app/crew", "Team", Users], ["/app/settings", "Settings", Settings]] }],
} satisfies Record<string, { label: string; items: [string, string, typeof Home][] }[]>;

export function WorkspaceFrame({ children, path, name, company, preview = false, onSignOut, admin, weatherUserId }: Props) {
  const navigate = useNavigate();
  const [paneOpen, setPaneOpen] = useState(() => window.innerWidth >= 768);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [documents, setDocuments] = useState([path]);
  const href = (to: string) => preview ? `/workspace-preview?section=${encodeURIComponent(to)}` : to;
  const title = documentName(path);
  const visibleDocuments = documents.includes(path) ? documents : [...documents.slice(-7), path];
  useEffect(() => {
    document.documentElement.classList.add("access-workspace");
    return () => document.documentElement.classList.remove("access-workspace");
  }, []);
  useEffect(() => { setDocuments(current => current.includes(path) ? current : [...current.slice(-7), path]); }, [path]);
  const openDocument = (to: string) => { navigate(href(to)); if (window.innerWidth < 768) setPaneOpen(false); };
  const groups = workspaceGroups.map(group => ({ ...group, matches: group.items.filter(item => `${group.label} ${item.label}`.toLowerCase().includes(search.toLowerCase())) })).filter(group => group.matches.length);

  return <div className={cn("access-theme access-app", weatherUserId && !preview && "has-weather")}>
    {weatherUserId && !preview && <WeatherBackdrop key={weatherUserId} userId={weatherUserId} />}
    <header className="access-chrome">
      <div className="access-titlebar"><Link to={href("/app")} className="access-brand"><img src={fasttractLogo} alt="FastTract" width={26} height={26} /><strong>FastTract</strong></Link><span className="access-window-title">{company} — Business workspace</span><span className="access-user">{name}</span></div>
      <Tabs defaultValue="home" className="access-ribbon">
        <div className="access-ribbon-tabs">
          <DropdownMenu><DropdownMenuTrigger className="access-file-menu">File</DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onClick={() => openDocument("/app")}>Open overview</DropdownMenuItem><DropdownMenuItem onClick={() => openDocument("/app/settings")}>Account settings</DropdownMenuItem>{onSignOut && <DropdownMenuItem onClick={onSignOut}>Sign out</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
          <TabsList aria-label="Ribbon" className="access-ribbon-tablist"><TabsTrigger value="home">Home</TabsTrigger><TabsTrigger value="records">Records</TabsTrigger><TabsTrigger value="company">Company</TabsTrigger><TabsTrigger value="view">View</TabsTrigger></TabsList>
        </div>
        {Object.entries(commands).map(([key, sections]) => <TabsContent key={key} value={key} className="access-ribbon-panel">{sections.map(section => <div key={section.label} className="access-command-group"><div>{section.items.map(([to, label, Icon]) => <Link to={href(to)} className="access-command" key={to}><Icon aria-hidden="true" /><span>{label}</span></Link>)}</div><small>{section.label}</small></div>)}</TabsContent>)}
        <TabsContent value="view" className="access-ribbon-panel"><div className="access-command-group"><div><button className="access-command" aria-pressed={paneOpen} onClick={() => setPaneOpen(value => !value)}><PanelLeft /><span>Navigation pane</span></button></div><small>Show / hide</small></div><div className="access-command-group"><div><Link className="access-command" to={href("/app/jobs")}><FolderOpen /><span>Job folders</span></Link><Link className="access-command" to={href("/app/customers")}><Table2 /><span>Customer table</span></Link></div><small>Open a view</small></div></TabsContent>
      </Tabs>
    </header>
    <div className="access-desktop">
      {paneOpen && <aside className="access-navigation" aria-label="Navigation pane">
        <div className="access-navigation-heading"><strong>All FastTract Objects</strong><button aria-label="Hide navigation pane" onClick={() => setPaneOpen(false)}><PanelLeft size={15} /></button></div>
        <div className="access-object-search"><Search size={14} aria-hidden="true" /><input aria-label="Search workspace objects" placeholder="Search objects…" value={search} onChange={event => setSearch(event.target.value)} /></div>
        <nav aria-label="Workspace" className="access-object-list">{groups.map(group => {
          const expanded = Boolean(search) || !collapsed.includes(group.label);
          return <section key={group.label}><button className="access-object-group" aria-expanded={expanded} onClick={() => setCollapsed(current => current.includes(group.label) ? current.filter(label => label !== group.label) : [...current, group.label])}>{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}{group.label}</button>{expanded && group.matches.map(item => <Link key={item.to} to={href(item.to)} onClick={() => { if (window.innerWidth < 768) setPaneOpen(false); }} aria-current={path === item.to ? "page" : undefined} className={cn("access-object", path === item.to && "is-active")}><item.icon size={15} aria-hidden="true" />{item.label}</Link>)}</section>;
        })}{!groups.length && <p className="p-3 text-xs text-muted-foreground">No matching objects.</p>}{admin && <section><div className="access-object-group">Administration</div><Link className="access-object" to="/admin">Platform admin</Link><Link className="access-object" to="/app/developer">Developer</Link></section>}</nav>
        {onSignOut && <button className="access-signout" onClick={onSignOut}><LogOut size={14} /> Sign out</button>}
      </aside>}
      <div className="access-document-area">
        <div className="access-document-tabs" aria-label="Open workspace documents"><button className="access-pane-toggle" aria-label={paneOpen ? "Hide navigation pane" : "Show navigation pane"} onClick={() => setPaneOpen(value => !value)}><PanelLeft size={16} /></button>{visibleDocuments.map(to => <div key={to} className={cn("access-document-tab", to === path && "is-active")}><Link aria-current={to === path ? "page" : undefined} to={href(to)}><FileText size={14} aria-hidden="true" />{documentName(to)}</Link>{visibleDocuments.length > 1 && <button aria-label={`Close ${documentName(to)}`} onClick={() => { const remaining = visibleDocuments.filter(item => item !== to); setDocuments(remaining); if (to === path) openDocument(remaining[remaining.length - 1] || "/app"); }}><X size={12} /></button>}</div>)}</div>
        <main className="access-document-content">{children}</main>
      </div>
    </div>
    <footer className="access-statusbar"><span className="access-ready-dot" /><span>{preview ? "Preview · sample data" : "Ready"}</span><span className="access-status-document">{title}</span><span className="ml-auto truncate">{company}</span></footer>
  </div>;
}
