"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { qk } from "../keys";
import type { GrantRequestBody, PermissionOut } from "../types";

export function useFilePermissions(fileId: string | undefined, includeInactive = false) {
  return useQuery({
    queryKey: [...qk.permissions(fileId ?? ""), includeInactive] as const,
    queryFn: () =>
      api.get<PermissionOut[]>(
        `/files/${fileId}/permissions${includeInactive ? "?include_inactive=true" : ""}`
      ),
    enabled: !!fileId,
  });
}

export function useGrantPermission(fileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GrantRequestBody) => api.post<PermissionOut>(`/files/${fileId}/permissions`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.permissions(fileId) }),
  });
}

/** DELETE /permissions/{id} - not a nested route, so this only needs the file id to invalidate the right cache entry. */
export function useRevokePermission(fileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (permissionId: string) => api.delete<void>(`/permissions/${permissionId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.permissions(fileId) }),
  });
}
