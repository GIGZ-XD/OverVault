"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

export interface StorageNode {
  id: string;
  name: string;
  hostname: string;
  ip_address: string;
  region: string;
  allocated_storage_gb: number;
  used_storage_gb: number;
  status: "online" | "offline" | "syncing" | "draining" | string;
  health_score: number;
  latency_ms: number;
  uptime_percentage: number;
  is_bootstrap: boolean;
  agent_version: string;
  stored_chunks_count: number;
  last_heartbeat: string;
  created_at: string;
}

export interface ReplicationPolicy {
  replication_factor: number;
  min_write_quorum: number;
  auto_rebalance: boolean;
  heartbeat_interval_sec: number;
  encryption_mode: string;
}

export interface NodeRegistrationToken {
  token: string;
  expires_at: string;
  install_command: string;
}

export function useNodes() {
  return useQuery({
    queryKey: ["nodes"],
    queryFn: () => api.get<StorageNode[]>("/nodes"),
    refetchInterval: 10000,
  });
}

export function useReplicationPolicy() {
  return useQuery({
    queryKey: ["nodes", "replication-policy"],
    queryFn: () => api.get<ReplicationPolicy>("/nodes/replication-policy"),
  });
}

export function useRegisterNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      hostname: string;
      ip_address: string;
      region: string;
      allocated_storage_gb: number;
    }) => api.post<StorageNode>("/nodes/register", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nodes"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useUpdateAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, allocatedGb }: { nodeId: string; allocatedGb: number }) =>
      api.put<StorageNode>(`/nodes/${nodeId}/allocation`, { allocated_storage_gb: allocatedGb }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nodes"] });
    },
  });
}

export function useDecommissionNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nodeId: string) =>
      api.delete<{ status: string; evacuated_chunks: number; message: string }>(`/nodes/${nodeId}/decommission`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nodes"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useUpdateReplicationPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (policy: Partial<ReplicationPolicy>) =>
      api.put<ReplicationPolicy>("/nodes/replication-policy", policy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nodes", "replication-policy"] });
    },
  });
}
