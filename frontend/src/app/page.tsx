"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api/token";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = getToken();
      if (token) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-ink-muted-48 font-mono text-xs">
      Initializing OverVault secure session...
    </div>
  );
}
