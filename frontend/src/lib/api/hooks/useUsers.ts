"use client";
import { useQuery } from "@tanstack/react-query";

import { api } from "../client";
import { qk } from "../keys";
import type { UserOut } from "../types";

/** Manager/admin/auditor only - the backend 403s for other roles. */
export function useUsers() {
  return useQuery({ queryKey: qk.users, queryFn: () => api.get<UserOut[]>("/users") });
}
