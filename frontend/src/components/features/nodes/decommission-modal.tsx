"use client";
import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck, ArrowRight, Server, CheckCircle2 } from "lucide-react";
import { StorageNode, useDecommissionNode } from "@/lib/api/hooks/useNodes";
import { useToast } from "@/components/ui/toast";

export interface DecommissionModalProps {
  node: StorageNode | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DecommissionModal({ node, isOpen, onClose, onSuccess }: DecommissionModalProps) {
  const [confirmAck, setConfirmAck] = useState(false);
  const decommissionMutation = useDecommissionNode();
  const { toast } = useToast();

  if (!node) return null;

  const handleDecommission = async () => {
    try {
      const res = await decommissionMutation.mutateAsync(node.id);
      toast("success", "Node Safely Decommissioned", res.message);
      onClose();
      onSuccess?.();
    } catch (err) {
      toast("error", "Decommission Failed", String(err));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Safely Decommission Node: ${node.name}`}
      description="Evacuate all encrypted chunk replicas to healthy cluster peers before server removal."
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" onClick={onClose} disabled={decommissionMutation.isPending}>
            Cancel
          </Button>

          <Button
            variant="danger"
            onClick={handleDecommission}
            isLoading={decommissionMutation.isPending}
            disabled={!confirmAck || node.is_bootstrap}
            leftIcon={<AlertTriangle className="w-4 h-4" />}
          >
            Evacuate & Remove Node
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Warning Banner */}
        <div className="p-3.5 rounded-[12px] bg-danger/10 border border-danger/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <span className="font-bold text-ink block">Zero-Data-Loss Evacuation Protocol</span>
            <p className="text-ink-muted-80">
              The network will automatically re-replicate all <strong>{node.stored_chunks_count}</strong> stored chunks to remaining online nodes before closing the node connection.
            </p>
          </div>
        </div>

        {/* Node Stats Preview */}
        <div className="p-3 rounded-[10px] bg-parchment border border-hairline space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-ink-muted-48 font-normal">Node Identifier</span>
            <span className="font-mono text-ink font-semibold">{node.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted-48 font-normal">Region / Host</span>
            <span className="text-ink">{node.region} ({node.hostname})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted-48 font-normal">Encrypted Data Volume</span>
            <span className="font-mono text-primary font-semibold">{node.used_storage_gb} GB ({node.stored_chunks_count} chunks)</span>
          </div>
        </div>

        {/* Evacuation Flow Diagram */}
        <div className="p-3 rounded-[10px] bg-canvas border border-hairline flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-danger" />
            <span className="text-ink">{node.name.slice(0, 14)}</span>
          </div>
          <ArrowRight className="w-4 h-4 text-primary animate-pulse" />
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-success" />
            <span className="text-success">Cluster Quorum Peers</span>
          </div>
        </div>

        {/* Confirmation Checkbox */}
        <label className="flex items-center gap-2.5 text-xs text-ink cursor-pointer pt-1 select-none">
          <input
            type="checkbox"
            checked={confirmAck}
            onChange={(e) => setConfirmAck(e.target.checked)}
            className="w-4 h-4 rounded text-primary accent-primary"
          />
          <span>I authorize data migration and permanent removal from the MST cluster.</span>
        </label>
      </div>
    </Modal>
  );
}
