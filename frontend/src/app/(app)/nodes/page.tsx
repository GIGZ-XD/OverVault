"use client";
import React, { useState } from "react";
import { Server, HardDrive, Plus, RefreshCw, Layers, ShieldCheck, Activity, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NetworkTopology } from "@/components/features/nodes/network-topology";
import { NodeTable } from "@/components/features/nodes/node-table";
import { AddNodeDialog } from "@/components/features/nodes/add-node-dialog";
import { DecommissionModal } from "@/components/features/nodes/decommission-modal";
import { ReplicationCard } from "@/components/features/nodes/replication-card";
import { useNodes, useReplicationPolicy, StorageNode } from "@/lib/api/hooks/useNodes";
import { useToast } from "@/components/ui/toast";

export default function StorageNodesPage() {
  const { data: nodes = [], isLoading, refetch } = useNodes();
  const { data: replicationPolicy } = useReplicationPolicy();
  const [activeTab, setActiveTab] = useState<"cluster" | "topology" | "policy">("cluster");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [decommissionNode, setDecommissionNode] = useState<StorageNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<StorageNode | null>(null);

  const { toast } = useToast();

  // Metrics calculations
  const totalAllocatedGb = nodes.reduce((acc, n) => acc + (n.allocated_storage_gb || 0), 0);
  const totalUsedGb = nodes.reduce((acc, n) => acc + (n.used_storage_gb || 0), 0);
  const onlineCount = nodes.filter((n) => n.status === "online").length;
  const avgHealth = Math.round(
    nodes.reduce((acc, n) => acc + (n.health_score || 0), 0) / (nodes.length || 1)
  );

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink tracking-tight">Decentralized Storage Nodes</h2>
          <p className="text-xs text-ink-muted-48 mt-0.5 font-normal">
            Build and manage your private multi-server decentralized storage network with on-chain verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              refetch();
              toast("success", "Nodes Synced", "Refreshed storage node telemetry");
            }}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddOpen(true)}
          >
            Add Storage Node
          </Button>
        </div>
      </div>

      {/* Cluster Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted-48">Connected Nodes</span>
              <div className="p-2 rounded-[10px] bg-primary/10 text-primary">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-ink tracking-tight">
                {onlineCount} / {nodes.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-success font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" /> 100% Mesh Quorum
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted-48">Cluster Capacity</span>
              <div className="p-2 rounded-[10px] bg-primary/10 text-primary">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-ink tracking-tight">
                {(totalAllocatedGb / 1000).toFixed(1)} TB
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted-48 font-mono">
              {totalUsedGb.toFixed(1)} GB used across {nodes.length} nodes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted-48">Replication Factor</span>
              <div className="p-2 rounded-[10px] bg-primary/10 text-primary">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-ink tracking-tight">
                {replicationPolicy?.replication_factor ?? 3}x Copies
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted-48 font-mono">
              Min write quorum: {replicationPolicy?.min_write_quorum ?? 2} nodes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted-48">Cluster Health</span>
              <div className="p-2 rounded-[10px] bg-success/10 text-success">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-ink tracking-tight">
                {avgHealth}%
              </span>
            </div>
            <p className="mt-1 text-xs text-success font-mono">
              AES-256-GCM encrypted chunks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Segmented View Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: "cluster", label: "Nodes & Storage Allocation" },
          { id: "topology", label: "Interactive Mesh Topology" },
          { id: "policy", label: "Replication & Redundancy" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-150 ${
              activeTab === tab.id
                ? "bg-primary text-white shadow-sm"
                : "bg-parchment text-ink-muted-80 hover:text-ink hover:bg-parchment/80 border border-hairline"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Cluster Nodes Table + Topology Preview */}
      {activeTab === "cluster" && (
        <div className="space-y-6">
          <NodeTable
            nodes={nodes}
            isLoading={isLoading}
            onSelectNode={(node) => setSelectedNode(node)}
            onDecommission={(node) => setDecommissionNode(node)}
          />

          <NetworkTopology
            nodes={nodes}
            onSelectNode={(node) => setSelectedNode(node)}
          />
        </div>
      )}

      {/* Tab 2: Full Interactive Mesh Topology */}
      {activeTab === "topology" && (
        <div className="space-y-6">
          <NetworkTopology
            nodes={nodes}
            onSelectNode={(node) => setSelectedNode(node)}
          />

          <NodeTable
            nodes={nodes}
            isLoading={isLoading}
            onSelectNode={(node) => setSelectedNode(node)}
            onDecommission={(node) => setDecommissionNode(node)}
          />
        </div>
      )}

      {/* Tab 3: Replication Policy */}
      {activeTab === "policy" && (
        <ReplicationCard policy={replicationPolicy} />
      )}

      {/* Add Node Dialog */}
      <AddNodeDialog
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onNodeAdded={() => refetch()}
      />

      {/* Safe Decommission Modal */}
      <DecommissionModal
        node={decommissionNode}
        isOpen={!!decommissionNode}
        onClose={() => setDecommissionNode(null)}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
