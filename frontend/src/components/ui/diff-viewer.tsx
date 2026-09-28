import React from "react";
import { cn } from "@/lib/utils";

export interface DiffLine {
  type: "add" | "remove" | "normal";
  content: string;
  lineNumberOld?: number;
  lineNumberNew?: number;
}

export interface DiffViewerProps {
  lines: DiffLine[];
  oldTitle?: string;
  newTitle?: string;
  className?: string;
}

export function DiffViewer({ lines, oldTitle = "Previous Version", newTitle = "Proposed Change", className }: DiffViewerProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface-2/40 overflow-hidden font-mono text-xs", className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-3/40 text-text-muted text-[11px] font-semibold">
        <span>{oldTitle}</span>
        <span>→</span>
        <span>{newTitle}</span>
      </div>
      <div className="divide-y divide-border/30 overflow-x-auto max-h-[300px]">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className={cn(
              "flex items-center px-3 py-1 font-mono leading-relaxed",
              line.type === "add" && "bg-emerald-500/10 text-emerald-300",
              line.type === "remove" && "bg-rose-500/10 text-rose-300",
              line.type === "normal" && "text-text-muted"
            )}
          >
            <span className="w-8 text-text-dim text-[10px] select-none text-right pr-2">
              {line.lineNumberOld || " "}
            </span>
            <span className="w-8 text-text-dim text-[10px] select-none text-right pr-3 border-r border-border/40 mr-3">
              {line.lineNumberNew || " "}
            </span>
            <span className="w-4 select-none shrink-0 font-bold">
              {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
            </span>
            <span className="whitespace-pre flex-1">{line.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
