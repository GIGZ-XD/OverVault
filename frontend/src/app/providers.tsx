"use client";
import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/lib/config";

import { getToken, setToken } from "@/lib/api/token";

let mswPromise: Promise<void> | null = null;

async function initServices() {
  if (typeof window === "undefined") return;

  if (config.apiMode === "mock") {
    if (!mswPromise) {
      mswPromise = (async () => {
        try {
          const { worker } = await import("@/mocks/browser");
          await worker.start({
            onUnhandledRequest: "bypass",
            serviceWorker: {
              url: "/mockServiceWorker.js",
            },
          });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (!errorMsg.includes("already enabled")) {
            console.warn("MSW initialization notice:", err);
          }
        }
      })();
    }
    return mswPromise;
  } else {
    // Real API mode: Ensure we have a valid dev session token for API requests
    try {
      const res = await fetch(`${config.apiUrl}/api/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "u1" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          setToken(data.access_token);
        }
      }
    } catch (err) {
      console.warn("Auto-authentication with backend failed:", err);
    }
  }
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initServices().finally(() => {
      setIsReady(true);
    });
  }, []);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-ink-muted-48 text-xs font-mono">
        Initializing vault services...
      </div>
    );
  }

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
