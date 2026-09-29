"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import type { AuditEvent } from "../types";

export function useAudit() {
  return useQuery({
    queryKey: ["audit"],
    queryFn: () => api.get<AuditEvent[]>("/audit"),
  });
}
