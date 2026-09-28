"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/lib/config";

let mswPromise: Promise<void> | null = null;

async function initMocks(): Promise<void> {
  if (typeof window === "undefined" || config.apiMode !== "mock") return;

  if (!mswPromise) {
    mswPromise = (async () => {
      try {
        const { worker } = await import("@/mocks/browser");
        await worker.start({
          onUnhandledRequest: "bypass",
          serviceWorker: { url: "/mockServiceWorker.js" },
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("already enabled")) {
          console.warn("MSW initialization notice:", error);
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
  const [isReady, setIsReady] = useState(config.apiMode !== "mock");

  useEffect(() => {
    initMocks().finally(() => setIsReady(true));
  }, []);

  return (
    <QueryClientProvider client={client}>
      {isReady ? children : (
        <div className="flex min-h-screen items-center justify-center bg-bg text-text-muted text-xs font-mono">
          Initializing vault services...
        </div>
      )}
    </QueryClientProvider>
  );
}
