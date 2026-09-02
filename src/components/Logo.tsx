import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import logoLockup from "@/assets/fasttract-logo-v2.png";

export function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn("flex items-center", className)} aria-label="FastTract home">
      <img
        src={logoLockup}
        alt="FastTract"
        width={190}
        height={64}
        className="h-10 w-auto object-contain sm:h-11"
      />
    </Link>
  );
}
