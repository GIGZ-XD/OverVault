import React from "react";
import { cn } from "@/lib/utils";
import { Shield, Eye, Edit3, UserCheck, Key } from "lucide-react";

export interface PermissionPillProps {
  permission: "read" | "write" | "admin" | "owner" | string;
  className?: string;
}

export function PermissionPill({ permission, className }: PermissionPillProps) {
  const perm = permission.toLowerCase();

  const config = {
    read: { label: "Read Only", icon: <Eye className="w-3 h-3" />, color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
    write: { label: "Write Access", icon: <Edit3 className="w-3 h-3" />, color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
    admin: { label: "Admin", icon: <UserCheck className="w-3 h-3" />, color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
    owner: { label: "Owner", icon: <Shield className="w-3 h-3" />, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  }[perm] || { label: permission, icon: <Key className="w-3 h-3" />, color: "bg-surface-2 text-text-muted border-border" };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-md border tracking-tight",
        config.color,
        className
      )}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
}
