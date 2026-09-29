"use client";
import React, { useState, useEffect } from "react";
import { FileTable, VaultFile } from "@/components/features/files/file-table";
import { FileDrawer } from "@/components/features/files/file-drawer";
import { Share2, Lock, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";

export default function SharedPage() {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
      <div>
        <h2 className="text-xl font-bold text-ink flex items-center gap-2">
          <Share2 className="w-5 h-5 text-accent" /> Shared Vault Documents
        </h2>
        <p className="text-xs text-ink-muted-48 mt-0.5">
          Documents shared with your account or organization role with read/write grants.
        </p>
      </div>

      <FileTable
        files={files}
        isLoading={isLoading}
        onSelectFile={(f) => {
          setSelectedFile(f);
          setDrawerOpen(true);
        }}
        onDownload={handleDownload}
      />

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
