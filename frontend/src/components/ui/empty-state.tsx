import React from "react";
import { cn } from "@/lib/utils";
import { FolderOpen } from "lucide-react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon = <FolderOpen className="w-11 h-11 text-ink-muted-48" strokeWidth={1.5} />,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  // Apple Design System: EmptyState - clean whitespace, 44px muted icon, semiBold title, 320 max width body
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center rounded-[14px] bg-canvas border border-hairline",
        className
      )}
    >
      <div className="mb-3 text-ink-muted-48">{icon}</div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="text-sm font-normal text-ink-muted-48 max-w-[320px] mt-1 mb-4 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export default EmptyState;
