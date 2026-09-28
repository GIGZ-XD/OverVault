"use client";
import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/lib/config";

let mswPromise: Promise<void> | null = null;

async function initMocks() {
  if (typeof window === "undefined" || config.apiMode !== "mock") {
    return;
  }
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
    initMocks().finally(() => {
      setIsReady(true);
    });
  }, []);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-text-muted text-xs font-mono">
        Initializing vault services...
      </div>
    );
  }

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
