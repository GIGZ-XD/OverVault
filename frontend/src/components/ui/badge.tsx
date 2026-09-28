import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "verified"
    | "pending"
    | "tampered"
    | "read-only"
    | "append-only"
    | "active"
    | "expired"
    | "revoked"
    | "accent";
  dot?: boolean;
}

export function Badge({ className, variant = "default", dot = true, children, ...props }: BadgeProps) {
  // Apple Design System: Status palette (colors.md / components.md)
  // State only, never for style. Pill radius (rounded-full).
  const variantStyles = {
    default: "bg-parchment text-ink-muted-80 border-hairline",
    verified: "bg-success/10 text-success border-success/20",
    pending: "bg-warning/10 text-warning border-warning/20",
    tampered: "bg-danger/10 text-danger border-danger/20",
    "read-only": "bg-primary/10 text-primary border-primary/20",
    "append-only": "bg-primary/10 text-primary border-primary/20",
    active: "bg-primary text-white border-primary", // Held/active is filled primary
    expired: "bg-parchment text-ink-muted-48 border-hairline",
    revoked: "bg-danger/10 text-danger border-danger/20",
    accent: "bg-primary/10 text-primary border-primary/20",
  };

  const dotColors = {
    default: "bg-ink-muted-48",
    verified: "bg-success",
    pending: "bg-warning",
    tampered: "bg-danger",
    "read-only": "bg-primary",
    "append-only": "bg-primary",
    active: "bg-white",
    expired: "bg-ink-muted-48",
    revoked: "bg-danger",
    accent: "bg-primary",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border tracking-wide uppercase font-mono select-none whitespace-nowrap shrink-0",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColors[variant])} />}
      <span className="whitespace-nowrap">{children}</span>
    </span>
  );
}

export default Badge;
