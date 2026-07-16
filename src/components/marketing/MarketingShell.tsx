import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

const footerCols = [
  {
    title: "Product",
    links: [
      { to: "/features", label: "Features" },
      { to: "/pricing", label: "Pricing" },
      { to: "/ai-photo-estimator", label: "AI Photo Estimator" },
      { to: "/ai-phone-agent", label: "AI Phone Agent" },
      { to: "/contractor-crm", label: "Contractor CRM" },
      { to: "/estimate-software", label: "Estimate Software" },
      { to: "/invoice-software", label: "Invoice Software" },
    ],
  },
  {
    title: "By Trade",
    links: [
      { to: "/concrete-contractor-software", label: "Concrete" },
      { to: "/framing-contractor-software", label: "Framing" },
      { to: "/fencing-contractor-software", label: "Fencing" },
      { to: "/landscaping-contractor-software", label: "Landscaping" },
      { to: "/roofing-contractor-software", label: "Roofing" },
      { to: "/siding-contractor-software", label: "Siding" },
      { to: "/deck-builder-software", label: "Deck Builders" },
      { to: "/general-contractor-software", label: "General Contractors" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/resellers", label: "Reseller Program" },
      { to: "/blog", label: "Blog" },
      { to: "/contact", label: "Contact" },
      { to: "/login", label: "Sign in" },
      { to: "/signup", label: "Start free" },
      { to: "/legal/privacy", label: "Privacy" },
      { to: "/legal/terms", label: "Terms" },
      { to: "/legal/refunds", label: "Refunds" },
    ],
  },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-dark text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Logo to="/" />
        <nav className="hidden gap-6 text-sm text-muted-foreground md:flex">
          <Link to="/features" className="hover:text-foreground">Features</Link>
          <Link to="/ai-photo-estimator" className="hover:text-foreground">AI Estimator</Link>
          <Link to="/ai-phone-agent" className="hover:text-foreground">AI Phone</Link>
          <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link to="/blog" className="hover:text-foreground">Blog</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild><Link to="/login">Sign in</Link></Button>
          <Button asChild><Link to="/signup">Start Free</Link></Button>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-20 border-t border-border">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              FastTract by GetReddiy — the AI-powered operating system for contractors.
            </p>
          </div>
          {footerCols.map((col) => (
            <div key={col.title}>
              <div className="mb-3 text-sm font-semibold">{col.title}</div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="hover:text-foreground">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
            <div>© {new Date().getFullYear()} GetReddiy · FastTract</div>
            <div>AI-assisted estimates are drafts. Contractors approve and verify before sending final quotes.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function CTARow() {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      <Button size="lg" asChild><Link to="/signup">Start Free</Link></Button>
      <Button size="lg" variant="outline" asChild><Link to="/contact">Book a Demo</Link></Button>
      <Button size="lg" variant="ghost" asChild><Link to="/ai-photo-estimator">Try AI Estimate Lab</Link></Button>
    </div>
  );
}
