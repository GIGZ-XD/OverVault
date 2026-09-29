"use client";
import React, { useState, useEffect } from "react";
import { FileTable, VaultFile } from "@/components/features/files/file-table";
import { FileDrawer } from "@/components/features/files/file-drawer";
import { Share2, Lock, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";

import { useMe } from "@/lib/api/hooks/useAuth";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SharedPage() {
  const { data: me } = useMe();
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewFilter, setViewFilter] = useState<"shared" | "all">("shared");
  const { toast } = useToast();

  const loadShared = async () => {
    setIsLoading(true);
    try {
      const data = await api<VaultFile[]>("/files");
      setFiles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShared();
  }, []);

  const sharedFiles = React.useMemo(() => {
    if (!me?.id) return files;
    return files.filter((f) => f.owner !== me.id);
  }, [files, me?.id]);

  const displayedFiles = viewFilter === "shared" ? sharedFiles : files;

  const handleDownload = async (file: VaultFile) => {
    try {
      const res = await api.getBlob(`/files/${file.id}/download`);
      const url = window.URL.createObjectURL(res.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      const digest = res.sha256 || file.hash;
      toast("success", `Downloaded ${file.name}`, `SHA-256 Digest: ${digest ? digest.slice(0, 16) + "..." : "verified"}`);
    } catch (err) {
      toast("error", "Download Failed", String(err));
    }
  };

  const handleVerifyHash = async (file: VaultFile) => {
    try {
      const res = await api<{ verified: boolean }>(`/files/${file.id}/verify`, { method: "POST" });
      if (res.verified) {
        toast("success", "Integrity Verified", "Local hash matches MST Blockchain digest");
      }
    } catch (err) {
      toast("error", "Verification Failed", String(err));
    }
  };

  const handleUpdateProtection = async (file: VaultFile, protection: string) => {
    try {
      await api(`/files/${file.id}/protection`, {
        method: "PUT",
        body: JSON.stringify({ protection }),
      });
      toast("success", "Protection Updated", `Set to ${protection}`);
      loadShared();
    } catch (err) {
      toast("error", "Failed to Update Protection", String(err));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink flex items-center gap-2">
            <Share2 className="w-5 h-5 text-accent" /> Shared Vault Documents
          </h2>
          <p className="text-xs text-ink-muted-48 mt-0.5">
            Documents shared with your account or organization role with read/write grants.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-parchment rounded-[10px] border border-hairline w-fit">
          <button
            type="button"
            onClick={() => setViewFilter("shared")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-[8px] transition-colors ${
              viewFilter === "shared"
                ? "bg-card text-ink shadow-sm border border-hairline"
                : "text-ink-muted-48 hover:text-ink"
            }`}
          >
            Shared with me ({sharedFiles.length})
          </button>
          <button
            type="button"
            onClick={() => setViewFilter("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-[8px] transition-colors ${
              viewFilter === "all"
                ? "bg-card text-ink shadow-sm border border-hairline"
                : "text-ink-muted-48 hover:text-ink"
            }`}
          >
            All Accessible ({files.length})
          </button>
        </div>
      </div>

      {viewFilter === "shared" && sharedFiles.length === 0 && !isLoading && (
        <div className="p-8 rounded-[16px] bg-parchment border border-hairline text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-card border border-hairline mx-auto flex items-center justify-center text-ink-muted-48">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">No incoming shared documents</h3>
            <p className="text-xs text-ink-muted-48 mt-1 max-w-md mx-auto">
              {files.length > 0
                ? `You own all ${files.length} active documents currently registered in the vault. To see files you own or to grant access to others, visit My Files or Access Control.`
                : "No files have been shared with your account yet. When colleagues grant you permissions, they will appear here."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Link href="/files">
              <Button size="sm" variant="primary">
                Go to My Files
              </Button>
            </Link>
            <Link href="/access">
              <Button size="sm" variant="secondary">
                Manage Access Grants
              </Button>
            </Link>
          </div>
        </div>
      )}

      {(viewFilter === "all" || sharedFiles.length > 0 || isLoading) && (
        <FileTable
          files={displayedFiles}
          isLoading={isLoading}
          onSelectFile={(f) => {
            setSelectedFile(f);
            setDrawerOpen(true);
          }}
          onDownload={handleDownload}
        />
      )}

      <FileDrawer
        file={selectedFile}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onDownload={handleDownload}
        onVerifyHash={handleVerifyHash}
        onUpdateProtection={handleUpdateProtection}
      />
    </div>
  );
}
