"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { SummaryCards, DashboardSummary } from "@/components/features/dashboard/summary-cards";
import { FileTable, VaultFile } from "@/components/features/files/file-table";
import { UploadDropzoneModal } from "@/components/features/files/upload-dropzone";
import { FileDrawer } from "@/components/features/files/file-drawer";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShieldCheck, Plus, ArrowRight, Activity } from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | undefined>(undefined);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toast } = useToast();

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const [sumData, filesData] = await Promise.all([
        api<DashboardSummary>("/dashboard/summary").catch(() => undefined),
        api<VaultFile[]>("/files").catch(() => []),
      ]);
      setSummary(sumData);
      setFiles(filesData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleUpload = async (fileData: { name: string; size: number; protection: string; file?: File }) => {
    try {
      let created: VaultFile;
      if (fileData.file) {
        const form = new FormData();
        form.append("upload", fileData.file);
        form.append("comment", "Uploaded via OverVault Dashboard");
        created = await api<VaultFile>("/files", {
          method: "POST",
          body: form,
        });
      } else {
        const blob = new Blob(["OverVault encrypted payload"], { type: "text/plain" });
        const form = new FormData();
        form.append("upload", blob, fileData.name || "document.txt");
        form.append("comment", "Uploaded via OverVault Dashboard");
        created = await api<VaultFile>("/files", {
          method: "POST",
          body: form,
        });
      }
      toast("success", "File Uploaded & Hashed", `Registered ${created.name} on MST Blockchain`);
      loadDashboard();
    } catch (err) {
      toast("error", "Upload Failed", String(err));
    }
  };

  const handleDownload = async (file: VaultFile) => {
    try {
      const res = await api<{ content: string; hash: string }>(`/files/${file.id}/download`);
      toast("success", `Downloaded ${file.name}`, `Verified hash: ${res.hash.slice(0, 10)}...`);
    } catch (err) {
      toast("error", "Download Failed", String(err));
    }
  };

  const handleVerifyHash = async (file: VaultFile) => {
    try {
      const res = await api<{ verified: boolean; local_hash: string }>(`/files/${file.id}/verify`, {
        method: "POST",
      });
      if (res.verified) {
        toast("success", "Verification Passed", `SHA-256 hash verified on MST Blockchain`);
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
      toast("success", "Protection Updated", `Set protection mode to ${protection}`);
      loadDashboard();
    } catch (err) {
      toast("error", "Protection Update Failed", String(err));
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner / Welcome — Apple signature parchment tile */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-[14px] bg-canvas border border-hairline">
        <div>
          <h2 className="text-xl font-bold text-ink flex items-center gap-2">
            Enterprise Blockchain Document Storage
          </h2>
          <p className="text-xs text-ink-muted-48 mt-1 max-w-xl font-normal leading-relaxed">
            OverVault maintains end-to-end encrypted file privacy while committing SHA-256 proof digests to MST Blockchain for auditability.
          </p>
        </div>
        <Button
          size="md"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsUploadOpen(true)}
          className="shrink-0"
        >
          Upload Document
        </Button>
      </div>

      {/* Summary Cards */}
      <SummaryCards summary={summary} isLoading={isLoading} />

      {/* Main Grid: Recent Files + Chain Integrity Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Documents */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Recent Documents
            </h3>
            <Link href="/files">
              <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                View All Vault Files
              </Button>
            </Link>
          </div>

          <FileTable
            files={files.slice(0, 5)}
            isLoading={isLoading}
            onSelectFile={(f) => {
              setSelectedFile(f);
              setDrawerOpen(true);
            }}
            onDownload={handleDownload}
          />
        </div>

        {/* Right Col: Chain Integrity & Quick Status */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> Blockchain Integrity
          </h3>

          <Card className="border-hairline">
            <CardHeader>
              <CardTitle className="text-sm text-ink font-semibold">
                MST Testnet Verification Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-[10px] bg-parchment border border-hairline">
                <span className="text-ink-muted-48 font-normal">Network Status</span>
                <span className="font-mono text-success font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-[10px] bg-parchment border border-hairline">
                <span className="text-ink-muted-48 font-normal">Chain Contract</span>
                <span className="font-mono text-primary font-normal">0xOverVault...3a11</span>
              </div>

              <div className="p-3 rounded-[10px] bg-primary/10 border border-primary/20 text-ink space-y-1">
                <span className="font-semibold text-primary block">Outbox Worker Sync</span>
                <p className="text-[11px] text-ink-muted-80 font-normal">
                  Batch worker draining audit outbox events automatically every 30 seconds.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upload Dropzone Modal */}
      <UploadDropzoneModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={handleUpload}
      />

      {/* File Details Drawer */}
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
