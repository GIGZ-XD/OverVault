"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  LayoutDashboard,
  FileText,
  CheckSquare,
  Users,
  Share2,
  Settings,
  History,
  HardDrive,
  Cpu,
  Server,
  X,
} from "lucide-react";
import { useDashboardSummary } from "@/lib/api/hooks/useDashboard";
import { useMe } from "@/lib/api/hooks/useAuth";

export interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { data: summary } = useDashboardSummary();
  const { data: me } = useMe();
  const pendingCount = summary?.pending_approvals ?? 0;

  const userName = me?.name || "Enterprise User";
  const userRole = me?.role ? `${me.role.charAt(0).toUpperCase() + me.role.slice(1)} Identity` : "Authenticated User";
  const userInitials = me?.name
    ? me.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "OV";

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "My Files", href: "/files", icon: FileText },
    { label: "Shared with me", href: "/shared", icon: Share2 },
    { label: "Storage Nodes", href: "/nodes", icon: Server },
    { label: "Approvals", href: "/approvals", icon: CheckSquare },
    { label: "Audit Trail", href: "/audit", icon: History },
    { label: "Access Control (admin)", href: "/access", icon: Users },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full select-none">
      <div>
        {/* Brand Logo - Apple Clean */}
        <div className="p-5 border-b border-divider-soft flex items-center justify-between">
          <Link
            href="/dashboard"
            onClick={onCloseMobile}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-[10px] bg-primary flex items-center justify-center text-white transition-transform duration-150 active:scale-95">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-base text-ink tracking-tight">
                OverVault
              </span>
              <span className="block text-[10px] uppercase tracking-wider text-primary font-semibold">
                Enterprise
              </span>
            </div>
          </Link>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-full text-ink-muted-48 hover:text-ink hover:bg-parchment"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted-48">
            Vault
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2 rounded-full text-sm transition-all duration-150 select-none",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-ink-muted-80 hover:text-ink hover:bg-parchment font-normal"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors",
                    isActive ? "text-primary" : "text-ink-muted-48"
                  )}
                />
                <span>{item.label}</span>
                {item.href === "/approvals" && pendingCount > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-warning/20 text-warning">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status Widget — Apple StatGauge style */}
      <div className="p-4 border-t border-divider-soft space-y-3 bg-parchment/60">
        <div className="p-3.5 rounded-[12px] border border-hairline bg-canvas text-xs space-y-2.5">
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="flex items-center gap-1.5 text-ink">
              <Cpu className="w-3.5 h-3.5 text-primary" />
              MST Testnet
            </span>
            <span className="text-success font-semibold">Connected</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-ink-muted-48 font-normal">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-ink-muted-48" /> Quota
              </span>
              <span>{summary ? `${(summary.total_files * 0.15).toFixed(1)} GB / 5 GB` : "0.0 GB / 5 GB"}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-divider-soft overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(4, (summary?.total_files ?? 0) * 3))}%` }}
              />
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center justify-between pt-1 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-semibold text-xs shadow-sm">
              {userInitials}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-ink leading-tight truncate">{userName}</span>
              <span className="text-[10px] text-ink-muted-48 truncate">{userRole}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile, visible from md up) */}
      <aside className="hidden md:flex w-[240px] shrink-0 bg-canvas border-r border-hairline flex-col justify-between min-h-screen sticky top-0 h-screen z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (visible when mobileOpen is true on <md) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Scrim backdrop */}
          <div
            className="fixed inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <div className="relative w-[260px] max-w-[80vw] h-full bg-canvas border-r border-hairline shadow-2xl animate-fade-in">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
