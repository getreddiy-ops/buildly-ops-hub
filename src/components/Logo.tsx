import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <img
        src="/icon-192.png"
        alt="FastTract"
        width={32}
        height={32}
        className="h-8 w-8 object-contain"
      />
      <span className="text-base">Fast<span className="text-primary">Tract</span></span>
    </Link>
  );
}
