"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { qk } from "../keys";
import type { FileOut, ProtectionMode, VerifyResult } from "../types";

export function useFiles() {
  return useQuery({ queryKey: qk.files, queryFn: () => api.get<FileOut[]>("/files") });
}

export function useFile(fileId: string | undefined) {
  return useQuery({
    queryKey: qk.file(fileId ?? ""),
    queryFn: () => api.get<FileOut>(`/files/${fileId}`),
    enabled: !!fileId,
  });
}

export function useUploadFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, comment }: { file: File; comment?: string }) => {
      const form = new FormData();
      form.append("upload", file);
      if (comment) form.append("comment", comment);
      return api.postForm<FileOut>("/files", form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.files }),
  });
}

/** Returns { blob, sha256, version } - see client.ts's getBlob() for how to use the blob. */
export function useDownloadFile() {
  return useMutation({ mutationFn: (fileId: string) => api.getBlob(`/files/${fileId}/download`) });
}

/** Hits POST /files/{id}/verify. See ADR 0005: verified/chain_hash are placeholders until the chain layer lands. */
export function useVerifyFile() {
  return useMutation({ mutationFn: (fileId: string) => api.post<VerifyResult>(`/files/${fileId}/verify`) });
}

export function useSetProtection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, protection }: { fileId: string; protection: ProtectionMode }) =>
      api.put<FileOut>(`/files/${fileId}/protection`, { protection }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.file(vars.fileId) });
      qc.invalidateQueries({ queryKey: qk.files });
    },
  });
}

/** Soft delete - the file disappears from lists but its history/audit trail is kept. */
export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => api.delete<void>(`/files/${fileId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.files }),
  });
}
