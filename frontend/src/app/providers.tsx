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
    // Real API mode: Clean up any stale MSW service workers from browser cache
    if ("serviceWorker" in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          if (reg.active?.scriptURL.includes("mockServiceWorker.js")) {
            await reg.unregister();
            console.info("Unregistered stale MSW ServiceWorker:", reg.active.scriptURL);
          }
        }
      } catch (swErr) {
        console.warn("Could not unregister service worker:", swErr);
      }
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
