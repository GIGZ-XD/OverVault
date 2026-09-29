"use client";
import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Layers, RefreshCw, Cpu, Lock, Check } from "lucide-react";
import { ReplicationPolicy, useUpdateReplicationPolicy } from "@/lib/api/hooks/useNodes";
import { useToast } from "@/components/ui/toast";

export interface ReplicationCardProps {
  policy?: ReplicationPolicy;
  isLoading?: boolean;
}

export function ReplicationCard({ policy, isLoading }: ReplicationCardProps) {
  const [factor, setFactor] = useState(policy?.replication_factor ?? 3);
  const [minQuorum, setMinQuorum] = useState(policy?.min_write_quorum ?? 2);
  const [autoRebalance, setAutoRebalance] = useState(policy?.auto_rebalance ?? true);
  const [heartbeatSec, setHeartbeatSec] = useState(policy?.heartbeat_interval_sec ?? 15);

  const updateMutation = useUpdateReplicationPolicy();
  const { toast } = useToast();

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        replication_factor: factor,
        min_write_quorum: minQuorum,
        auto_rebalance: autoRebalance,
        heartbeat_interval_sec: heartbeatSec,
      });
      toast("success", "Replication Policy Updated", `Files will now replicate across ${factor} nodes minimum`);
    } catch (err) {
      toast("error", "Update Failed", String(err));
    }
  };

  return (
    <Card className="select-none">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle>
              <Layers className="w-4 h-4 text-primary" /> Replication & Redundancy Policy
            </CardTitle>
            <CardDescription>
              Configure cryptographic file chunk distribution and quorum thresholds across participating servers.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={handleSave}
            isLoading={updateMutation.isPending}
            className="text-xs h-8 font-normal"
          >
            Save Policy
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Replication Factor */}
          <div className="p-3.5 rounded-[12px] bg-parchment border border-hairline space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-ink">Replication Factor</span>
              <span className="font-bold font-mono text-primary text-sm">{factor}x Copies</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={factor}
              onChange={(e) => {
                const val = Number(e.target.value);
                setFactor(val);
                if (minQuorum > val) setMinQuorum(val);
              }}
              className="w-full accent-primary h-1.5 bg-canvas rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-ink-muted-48 leading-relaxed">
              Every document chunk is encrypted and mirrored across {factor} distinct geographic storage nodes.
            </p>
          </div>

          {/* Write Quorum */}
          <div className="p-3.5 rounded-[12px] bg-parchment border border-hairline space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-ink">Min Write Quorum</span>
              <span className="font-bold font-mono text-primary text-sm">{minQuorum} of {factor}</span>
            </div>
            <input
              type="range"
              min="1"
              max={factor}
              step="1"
              value={minQuorum}
              onChange={(e) => setMinQuorum(Number(e.target.value))}
              className="w-full accent-primary h-1.5 bg-canvas rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-ink-muted-48 leading-relaxed">
              Uploads succeed only when at least {minQuorum} nodes confirm on-chain SHA-256 integrity receipt.
            </p>
          </div>

          {/* Heartbeat & Recovery */}
          <div className="p-3.5 rounded-[12px] bg-parchment border border-hairline space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-ink">Heartbeat Interval</span>
              <span className="font-bold font-mono text-primary text-sm">{heartbeatSec}s</span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={heartbeatSec}
              onChange={(e) => setHeartbeatSec(Number(e.target.value))}
              className="w-full accent-primary h-1.5 bg-canvas rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-ink-muted-48 leading-relaxed">
              Frequency of cryptographic peer health verification pings.
            </p>
          </div>
        </div>

        {/* Feature Checkpoints */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
          <label className="flex items-center gap-2.5 p-3 rounded-[10px] bg-canvas border border-hairline cursor-pointer">
            <input
              type="checkbox"
              checked={autoRebalance}
              onChange={(e) => setAutoRebalance(e.target.checked)}
              className="w-4 h-4 rounded text-primary accent-primary"
            />
            <div>
              <span className="font-semibold text-ink block">Automated Self-Healing & Rebalancing</span>
              <span className="text-[11px] text-ink-muted-48">
                Automatically replicate missing chunk copies if a node goes offline.
              </span>
            </div>
          </label>

          <div className="flex items-center gap-2.5 p-3 rounded-[10px] bg-canvas border border-hairline">
            <Lock className="w-4 h-4 text-primary shrink-0" />
            <div>
              <span className="font-semibold text-ink block">Cipher & Proof Integrity</span>
              <span className="text-[11px] text-ink-muted-48 font-mono">
                AES-256-GCM authenticated encryption + MST Merkle root anchors.
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
