"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { qk } from "../keys";
import type { VersionOut } from "../types";

export function useFileVersions(fileId: string | undefined) {
  return useQuery({
    queryKey: qk.versions(fileId ?? ""),
    queryFn: () => api.get<VersionOut[]>(`/files/${fileId}/versions`),
    enabled: !!fileId,
  });
}

export function useUploadVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, file, comment }: { fileId: string; file: File; comment?: string }) => {
      const form = new FormData();
      form.append("upload", file);
      if (comment) form.append("comment", comment);
      return api.postForm<VersionOut>(`/files/${fileId}/versions`, form);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.versions(vars.fileId) });
      qc.invalidateQueries({ queryKey: qk.file(vars.fileId) });
      qc.invalidateQueries({ queryKey: qk.files });
    },
  });
}

export function useDownloadVersion() {
  return useMutation({
    mutationFn: ({ fileId, number }: { fileId: string; number: number }) =>
      api.getBlob(`/files/${fileId}/versions/${number}/download`),
  });
}

/** Rollback creates a NEW version copying `number` - history is never rewritten. */
export function useRollbackVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, number, comment }: { fileId: string; number: number; comment?: string }) =>
      api.post<VersionOut>(`/files/${fileId}/versions/${number}/rollback`, comment ? { comment } : undefined),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.versions(vars.fileId) });
      qc.invalidateQueries({ queryKey: qk.file(vars.fileId) });
      qc.invalidateQueries({ queryKey: qk.files });
    },
  });
}
