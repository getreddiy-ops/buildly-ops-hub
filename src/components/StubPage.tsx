import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { LucideIcon, Plus } from "lucide-react";
import { ReactNode } from "react";

export function StubPage({
  title,
  description,
  icon,
  emptyTitle,
  emptyDescription,
  ctaLabel,
  children,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
  ctaLabel?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={ctaLabel ? <Button><Plus className="h-4 w-4" /> {ctaLabel}</Button> : undefined}
      />
      {children ?? (
        <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
      )}
    </>
  );
}
