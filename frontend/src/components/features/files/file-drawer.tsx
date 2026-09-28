"use client";
import React, { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { VersionTimeline, DocumentVersion } from "@/components/features/versions/version-timeline";
import { formatBytes, formatDate, shortHash } from "@/lib/utils";
import {
  FileText,
  Download,
  ShieldCheck,
  ShieldAlert,
  GitBranch,
  KeyRound,
  RefreshCw,
  ExternalLink,
  Lock,
} from "lucide-react";
import { VaultFile } from "@/components/features/files/file-table";

export interface FileDrawerProps {
  file: VaultFile | null;
  isOpen: boolean;
  onClose: () => void;
  versions?: DocumentVersion[];
  onDownload: (file: VaultFile) => void;
  onVerifyHash: (file: VaultFile) => Promise<void>;
  onUpdateProtection: (file: VaultFile, protection: string) => Promise<void>;
  onRollbackVersion?: (version: DocumentVersion) => void;
}

export function FileDrawer({
  file,
  isOpen,
  onClose,
  versions = [],
  onDownload,
  onVerifyHash,
  onUpdateProtection,
  onRollbackVersion,
}: FileDrawerProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "versions" | "protection">("overview");
  const [isVerifying, setIsVerifying] = useState(false);
  const [protectionValue, setProtectionValue] = useState(file?.protection || "read-only");
  const [isSavingProtection, setIsSavingProtection] = useState(false);

  if (!file) return null;

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      await onVerifyHash(file);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveProtection = async () => {
    setIsSavingProtection(true);
    try {
      await onUpdateProtection(file, protectionValue);
    } finally {
      setIsSavingProtection(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-accent" />
          <span className="truncate">{file.name}</span>
        </div>
      }
      subtitle={`File ID: ${file.id}`}
      width="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            isLoading={isVerifying}
            onClick={handleVerify}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Verify On-Chain Hash
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => onDownload(file)}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Download Verified Copy
          </Button>
        </div>
      }
    >
      {/* Navigation Tabs */}
      <div className="flex border-b border-border gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-2 transition-colors border-b-2 ${
            activeTab === "overview"
              ? "border-accent text-accent font-bold"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          Overview & Audit
        </button>
        <button
          onClick={() => setActiveTab("versions")}
          className={`pb-2 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === "versions"
              ? "border-accent text-accent font-bold"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          Version History ({versions.length})
        </button>
        <button
          onClick={() => setActiveTab("protection")}
          className={`pb-2 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === "protection"
              ? "border-accent text-accent font-bold"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          Protection Rules
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* Integrity Banner */}
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-emerald-400">Cryptographic Integrity Verified</h4>
              <p className="text-xs text-text-muted mt-0.5">
                File hash matches the immutably logged digest on MST Blockchain.
              </p>
            </div>
          </div>

          {/* Details Table */}
          <div className="rounded-lg border border-border bg-surface-2/30 divide-y divide-border/60 text-xs">
            <div className="p-3 flex justify-between">
              <span className="text-text-muted font-medium">Owner / Author</span>
              <span className="font-mono text-text font-semibold">{file.owner}</span>
            </div>
            <div className="p-3 flex justify-between">
              <span className="text-text-muted font-medium">File Size</span>
              <span className="font-mono text-text">{formatBytes(file.size)}</span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <span className="text-text-muted font-medium">Protection Mode</span>
              <Badge variant={file.protection === "read-only" ? "read-only" : "default"}>
                {file.protection}
              </Badge>
            </div>
            <div className="p-3 flex justify-between items-center">
              <span className="text-text-muted font-medium">SHA-256 Hash</span>
              <span className="font-mono text-xs text-accent bg-surface-2 px-2 py-0.5 rounded border border-border/80">
                {file.hash}
              </span>
            </div>
            {file.ownership_tx && (
              <div className="p-3 flex justify-between items-center">
                <span className="text-text-muted font-medium">MST Transaction</span>
                <span className="font-mono text-xs text-sky-400 flex items-center gap-1 hover:underline cursor-pointer">
                  {file.ownership_tx} <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Version History */}
      {activeTab === "versions" && (
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            All document revisions are immutable and signed. Rollback restores previous content state on the blockchain.
          </p>
          <VersionTimeline
            versions={versions}
            onRollback={onRollbackVersion}
          />
        </div>
      )}

      {/* Tab 3: Protection Rules */}
      {activeTab === "protection" && (
        <div className="space-y-4 p-4 rounded-xl border border-border bg-surface-2/20">
          <h4 className="text-sm font-semibold text-text flex items-center gap-2">
            <Lock className="w-4 h-4 text-accent" /> Smart Contract Protection Mode
          </h4>
          <p className="text-xs text-text-muted">
            Update access rules enforced on-chain. Read-only prevents modifications; append-only allows adding new versions without overwriting existing history.
          </p>

          <Select
            options={[
              { label: "Read-Only (Strict protection)", value: "read-only" },
              { label: "Append-Only (Only append versions)", value: "append-only" },
              { label: "Standard / None (Unrestricted)", value: "none" },
            ]}
            value={protectionValue}
            onChange={(e) => setProtectionValue(e.target.value)}
          />

          <Button
            size="sm"
            variant="primary"
            isLoading={isSavingProtection}
            onClick={handleSaveProtection}
          >
            Save Protection Settings
          </Button>
        </div>
      )}
    </Drawer>
  );
}
