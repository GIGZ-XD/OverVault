"use client";
import React, { useState } from "react";
import { DataTable, Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Server, HardDrive, Trash2, Sliders, Shield, Activity, Wifi } from "lucide-react";
import { StorageNode, useUpdateAllocation } from "@/lib/api/hooks/useNodes";
import { useToast } from "@/components/ui/toast";

export interface NodeTableProps {
  nodes: StorageNode[];
  isLoading?: boolean;
  onSelectNode: (node: StorageNode) => void;
  onDecommission: (node: StorageNode) => void;
}

export function NodeTable({ nodes, isLoading, onSelectNode, onDecommission }: NodeTableProps) {
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [allocationValue, setAllocationValue] = useState<number>(500);

  const updateAllocationMutation = useUpdateAllocation();
  const { toast } = useToast();

  const handleSaveAllocation = async (node: StorageNode) => {
    try {
      await updateAllocationMutation.mutateAsync({
        nodeId: node.id,
        allocatedGb: allocationValue,
      });
      toast("success", "Storage Allocation Updated", `Set ${node.name} capacity to ${allocationValue} GB`);
      setEditingNodeId(null);
    } catch (err) {
      toast("error", "Update Failed", String(err));
    }
  };

  const columns: Column<StorageNode>[] = [
    {
      header: "Node & Hostname",
      accessorKey: "name",
      cell: (node) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-[10px] bg-parchment text-primary border border-hairline shrink-0">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                onClick={() => onSelectNode(node)}
                className="font-semibold text-ink hover:text-primary cursor-pointer text-sm"
              >
                {node.name}
              </span>
              {node.is_bootstrap && (
                <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold rounded-full bg-primary/10 text-primary border border-primary/20">
                  Bootstrap Core
                </span>
              )}
            </div>
            <span className="text-[11px] text-ink-muted-48 font-mono block">
              {node.hostname} • {node.ip_address}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Geographic Region",
      cell: (node) => (
        <div>
          <span className="text-xs font-semibold text-ink block">{node.region}</span>
          <span className="text-[10px] text-ink-muted-48 font-mono">Agent {node.agent_version}</span>
        </div>
      ),
    },
    {
      header: "Status & Health",
      className: "whitespace-nowrap",
      cell: (node) => {
        const isOnline = node.status === "online";
        const isSyncing = node.status === "syncing";
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Badge variant={isOnline ? "verified" : isSyncing ? "pending" : "tampered"}>
                {node.status.toUpperCase()}
              </Badge>
              <span className="text-[11px] font-mono text-ink font-semibold">
                {node.health_score}%
              </span>
            </div>
            <span className="text-[10px] text-ink-muted-48 font-mono flex items-center gap-1">
              <Wifi className="w-3 h-3 text-success" /> {node.latency_ms}ms • {node.uptime_percentage}% up
            </span>
          </div>
        );
      },
    },
    {
      header: "Contributed Storage Capacity",
      className: "w-64",
      cell: (node) => {
        const pct = Math.round((node.used_storage_gb / (node.allocated_storage_gb || 1)) * 100);
        const isEditing = editingNodeId === node.id;

        if (isEditing) {
          return (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                type="number"
                min={Math.ceil(node.used_storage_gb)}
                max={10000}
                value={allocationValue}
                onChange={(e) => setAllocationValue(Number(e.target.value))}
                className="w-20 px-2 py-1 rounded-md border border-hairline bg-parchment text-xs font-mono text-ink"
              />
              <span className="text-xs text-ink-muted-48">GB</span>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleSaveAllocation(node)}
                isLoading={updateAllocationMutation.isPending}
                className="text-[11px] h-6 px-2 font-normal"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingNodeId(null)}
                className="text-[11px] h-6 px-1.5 font-normal text-ink-muted-48"
              >
                ✕
              </Button>
            </div>
          );
        }

        return (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-ink font-semibold">{node.used_storage_gb} GB</span>
              <span className="text-ink-muted-48">of {node.allocated_storage_gb} GB ({pct}%)</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-parchment overflow-hidden border border-hairline">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  pct > 85 ? "bg-danger" : pct > 60 ? "bg-warning" : "bg-primary"
                }`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-ink-muted-48 font-mono block">
              {node.stored_chunks_count} encrypted chunks
            </span>
          </div>
        );
      },
    },
    {
      header: "Actions",
      className: "text-right whitespace-nowrap",
      cell: (node) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Sliders className="w-3.5 h-3.5" />}
            onClick={() => {
              setEditingNodeId(node.id);
              setAllocationValue(node.allocated_storage_gb);
            }}
            className="text-xs px-2.5 h-7 font-normal"
            title="Adjust Allocated Storage"
          >
            Adjust
          </Button>

          {!node.is_bootstrap && (
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Trash2 className="w-3.5 h-3.5 text-danger" />}
              onClick={() => onDecommission(node)}
              className="text-xs px-2.5 h-7 font-normal text-danger hover:bg-danger/10"
              title="Safely Decommission Node"
            >
              Remove
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={nodes}
      keyExtractor={(n) => n.id}
      isLoading={isLoading}
      onRowClick={onSelectNode}
    />
  );
}
