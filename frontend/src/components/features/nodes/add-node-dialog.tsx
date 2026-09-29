"use client";
import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Copy, Check, Terminal, Server, HardDrive, ShieldCheck, KeyRound } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { NodeRegistrationToken, useRegisterNode } from "@/lib/api/hooks/useNodes";

export interface AddNodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onNodeAdded?: () => void;
}

export function AddNodeDialog({ isOpen, onClose, onNodeAdded }: AddNodeDialogProps) {
  const [tab, setTab] = useState<"quick" | "manual">("quick");
  const [tokenData, setTokenData] = useState<NodeRegistrationToken | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Manual Form State
  const [name, setName] = useState("");
  const [hostname, setHostname] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [region, setRegion] = useState("US-East (N. Virginia)");
  const [allocatedGb, setAllocatedGb] = useState("500");

  const registerMutation = useRegisterNode();
  const { toast } = useToast();

  const handleGenerateToken = async () => {
    setIsGenerating(true);
    try {
      const res = await api<NodeRegistrationToken>("/nodes/token", { method: "POST" });
      setTokenData(res);
      toast("success", "Registration Token Generated", "Valid for 24 hours across cluster nodes");
    } catch (err) {
      toast("error", "Generation Failed", String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast("success", "Copied to Clipboard", "Ready to paste on your server terminal");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !hostname || !ipAddress) {
      toast("error", "Missing Fields", "Please complete all server details");
      return;
    }

    try {
      await registerMutation.mutateAsync({
        name,
        hostname,
        ip_address: ipAddress,
        region,
        allocated_storage_gb: Number(allocatedGb) || 500,
      });
      toast("success", "Storage Node Registered", `Joined decentralized mesh as [${name}]`);
      onClose();
      onNodeAdded?.();
      // Reset form
      setName("");
      setHostname("");
      setIpAddress("");
    } catch (err) {
      toast("error", "Registration Failed", String(err));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Decentralized Storage Node"
      description="Connect servers or private workstations to contribute encrypted storage capacity."
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          {tab === "manual" ? (
            <Button
              variant="primary"
              onClick={handleManualSubmit}
              isLoading={registerMutation.isPending}
              leftIcon={<Server className="w-4 h-4" />}
            >
              Register Node
            </Button>
          ) : (
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Method Segmented Switch */}
        <div className="grid grid-cols-2 p-1 rounded-full bg-parchment border border-hairline text-xs font-semibold select-none">
          <button
            onClick={() => setTab("quick")}
            className={`py-1.5 rounded-full transition-all duration-150 ${
              tab === "quick"
                ? "bg-primary text-white shadow-sm"
                : "text-ink-muted-80 hover:text-ink"
            }`}
          >
            One-Line Agent Setup (Recommended)
          </button>
          <button
            onClick={() => setTab("manual")}
            className={`py-1.5 rounded-full transition-all duration-150 ${
              tab === "manual"
                ? "bg-primary text-white shadow-sm"
                : "text-ink-muted-80 hover:text-ink"
            }`}
          >
            Manual Server Registration
          </button>
        </div>

        {tab === "quick" ? (
          <div className="space-y-4">
            <div className="p-4 rounded-[12px] bg-canvas border border-hairline space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-ink">Cluster Registration Token</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleGenerateToken}
                  isLoading={isGenerating}
                  className="text-xs h-7 font-normal"
                >
                  Generate New Token
                </Button>
              </div>

              {tokenData ? (
                <div className="flex items-center justify-between p-2.5 rounded-[8px] bg-parchment border border-hairline font-mono text-xs text-ink break-all">
                  <span className="truncate mr-2">{tokenData.token}</span>
                  <button
                    onClick={() => handleCopy(tokenData.token, setCopiedToken)}
                    className="p-1 hover:text-primary transition-colors shrink-0"
                    title="Copy Token"
                  >
                    {copiedToken ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-ink-muted-48">
                  Click generate to create an ephemeral cryptographic registration token for your node daemon.
                </p>
              )}
            </div>

            {/* Terminal Command Runner */}
            <div className="p-4 rounded-[12px] bg-[#0E1117] text-white border border-hairline space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between text-ink-muted-48 border-b border-gray-800 pb-2">
                <span className="flex items-center gap-1.5 text-gray-400">
                  <Terminal className="w-3.5 h-3.5 text-primary" /> Run on your Server (Linux / Mac / Docker)
                </span>
                <button
                  onClick={() =>
                    handleCopy(
                      tokenData?.install_command ||
                        "curl -sSL https://overvault.mst/install-agent.sh | sh -s -- --cluster=mst-corp-vault",
                      setCopiedCmd
                    )
                  }
                  className="hover:text-primary flex items-center gap-1 text-[11px] text-gray-300 transition-colors"
                >
                  {copiedCmd ? (
                    <>
                      <Check className="w-3 h-3 text-success" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy Command
                    </>
                  )}
                </button>
              </div>

              <div className="text-gray-300 break-all select-all leading-relaxed pt-1">
                {tokenData?.install_command ||
                  "curl -sSL https://overvault.mst/install-agent.sh | sh -s -- --cluster=mst-corp-vault"}
              </div>
            </div>

            <div className="p-3 rounded-[10px] bg-primary/10 border border-primary/20 flex items-start gap-2.5 text-xs text-ink">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                The lightweight daemon agent automatically runs in user-space, allocates local encrypted NVMe/SSD space, and handles chunk replication heartbeats.
              </span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Node Name"
                placeholder="e.g. US-West Storage Server 01"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Select
                label="Geographic Region"
                options={[
                  { label: "US-East (N. Virginia)", value: "US-East (N. Virginia)" },
                  { label: "US-West (Oregon)", value: "US-West (Oregon)" },
                  { label: "EU-Central (Frankfurt)", value: "EU-Central (Frankfurt)" },
                  { label: "EU-West (London)", value: "EU-West (London)" },
                  { label: "AP-South (Bangalore)", value: "AP-South (Bangalore)" },
                  { label: "AP-East (Tokyo)", value: "AP-East (Tokyo)" },
                  { label: "Local Edge Cluster", value: "Local Edge Cluster" },
                ]}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Hostname / FQDN"
                placeholder="node-04.corp.internal"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                required
              />
              <Input
                label="IP Address"
                placeholder="192.168.1.150"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-ink-muted-48 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-primary" /> Contributed Storage Allocation
                </label>
                <span className="font-bold font-mono text-primary">{allocatedGb} GB</span>
              </div>
              <input
                type="range"
                min="100"
                max="5000"
                step="50"
                value={allocatedGb}
                onChange={(e) => setAllocatedGb(e.target.value)}
                className="w-full accent-primary h-2 bg-parchment rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-ink-muted-48 font-mono">
                <span>100 GB</span>
                <span>1 TB</span>
                <span>2.5 TB</span>
                <span>5 TB</span>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
