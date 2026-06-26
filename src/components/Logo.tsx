import { Link } from "react-router-dom";
import { HardHat } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-md bg-gradient-primary text-primary-foreground shadow-elevated">
        <HardHat className="h-4 w-4" />
      </span>
      <span className="text-base">Contractor<span className="text-primary">OS</span></span>
    </Link>
  );
}
