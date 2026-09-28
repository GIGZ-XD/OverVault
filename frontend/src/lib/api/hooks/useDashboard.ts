"use client";
import { useQuery } from "@tanstack/react-query";

import { api } from "../client";
import { qk } from "../keys";
import type { DashboardSummary } from "../types";

export function useDashboardSummary() {
  return useQuery({ queryKey: qk.dashboard, queryFn: () => api.get<DashboardSummary>("/dashboard/summary") });
}
