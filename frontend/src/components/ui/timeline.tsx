import React from "react";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  id: string;
  title: React.ReactNode;
  timestamp?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  return (
    <div className={cn("relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border", className)}>
      {items.map((item) => (
        <div key={item.id} className="relative flex flex-col gap-1 group">
          <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-surface border-2 border-accent flex items-center justify-center text-accent shrink-0 group-hover:scale-110 transition-transform">
            {item.icon || <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
          </div>
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-text flex items-center gap-2">{item.title}</h4>
            {item.badge}
          </div>
          {item.timestamp && <span className="text-[11px] font-mono text-text-dim">{item.timestamp}</span>}
          {item.description && <div className="text-xs text-text-muted mt-1">{item.description}</div>}
        </div>
      ))}
    </div>
  );
}
