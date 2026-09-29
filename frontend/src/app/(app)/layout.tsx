"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import { getToken } from "@/lib/api/token";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && !getToken()) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar with Desktop & Mobile Drawer support */}
      <Sidebar
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen overflow-x-hidden">
        <Topbar onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)} />
        <main className="flex-1 w-full mx-auto max-w-[1280px] p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
