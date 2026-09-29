"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, Bell, Sun, Moon, Menu } from "lucide-react";
import { shortHash } from "@/lib/utils";
import { useMe } from "@/lib/api/hooks/useAuth";

export interface TopbarProps {
  onToggleMobileNav?: () => void;
}

export default function Topbar({ onToggleMobileNav }: TopbarProps) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const { data: currentUser } = useMe();
  const [localName, setLocalName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLocalName(localStorage.getItem("overvault_user_name"));
    }
  }, [currentUser]);

  const displayName = localName || currentUser?.name || "Operator";
  const userWallet = currentUser?.wallet_address || "0xaaa1";
  const userInitials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    setTheme(currentTheme as "dark" | "light");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  const getPageTitle = (path: string) => {
    if (path.includes("/files")) return "My Files";
    if (path.includes("/nodes")) return "Storage Nodes";
    if (path.includes("/approvals")) return "Approvals";
    if (path.includes("/access")) return "Access Control";
    if (path.includes("/audit")) return "Audit Trail";
    if (path.includes("/shared")) return "Shared with me";
    if (path.includes("/settings")) return "Settings & Profile";
    return "Dashboard";
  };

  return (
    <header className="h-14 px-4 sm:px-6 border-b border-hairline bg-canvas sticky top-0 z-30 flex items-center justify-between select-none">
      {/* Left: Mobile Hamburger & Page Title */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {onToggleMobileNav && (
          <button
            onClick={onToggleMobileNav}
            aria-label="Open navigation menu"
            className="md:hidden p-1.5 rounded-full text-ink-muted-48 hover:text-ink hover:bg-parchment transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-base sm:text-lg font-semibold text-ink tracking-tight truncate">
          {getPageTitle(pathname || "")}
        </h1>
      </div>

      {/* Right: Search, Wallet & Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Apple Pill Search Input - Responsive */}
        <div className="hidden sm:block sm:w-44 md:w-60">
          <Input
            pill
            placeholder="Search files, hashes..."
            leftIcon={<Search className="w-3.5 h-3.5 text-ink-muted-48" />}
            className="text-xs h-8"
          />
        </div>

        {/* Wallet Chip: Pill with hairline border (compact on smaller screens) */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-full border border-hairline bg-parchment text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
          <span className="text-ink font-normal">{shortHash(userWallet)}</span>
          <span className="text-[10px] uppercase font-semibold text-primary hidden md:inline">
            MST
          </span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-1.5 sm:p-2 rounded-full text-ink-muted-48 hover:text-ink hover:bg-parchment transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notification Bell */}
        <button
          aria-label="Notifications"
          className="relative p-1.5 sm:p-2 rounded-full text-ink-muted-48 hover:text-ink hover:bg-parchment transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-danger" />
        </button>

        {/* User Profile Avatar Link */}
        <Link
          href="/settings#profile"
          title={`Profile: ${displayName} (${currentUser?.role || "employee"})`}
          className="flex items-center pl-1 sm:pl-2 border-l border-divider-soft group"
        >
          <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-semibold text-xs group-hover:scale-105 transition-transform">
            {userInitials}
          </div>
        </Link>
      </div>
    </header>
  );
}
