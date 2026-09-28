"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { config } from "@/lib/config";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());

  useEffect(() => {
    if (config.apiMode !== "mock") return;

    void import("@/mocks/browser").then(({ startMockWorker }) =>
      startMockWorker()
    );
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
