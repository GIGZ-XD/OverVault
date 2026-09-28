"use client";

import { useState } from "react";
import Link from "next/link";
import { SummaryCards } from "@/components/features/dashboard/summary-cards";
import IntegrityWidget from "@/components/features/dashboard/integrity-widget";
import { FileTable, type VaultFile } from "@/components/features/files/file-table";
import { UploadDropzoneModal } from "@/components/features/files/upload-dropzone";
import { FileDrawer } from "@/components/features/files/file-drawer";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShieldCheck, Plus, ArrowRight, Activity } from "lucide-react";
import { api } from "@/lib/api/client";
import { useFiles } from "@/lib/api/hooks/useFiles";
import { useDashboardSummary } from "@/lib/api/hooks/useDashboard";
import { useToast } from "@/components/ui/toast";

function verificationState(value: string): "verified" | "pending" | "tampered" {
  if (value === "pending") return "pending";
  if (value === "tampered" || value === "failed") return "tampered";
  return "verified";
}

export default function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: queriedFiles = [], isLoading: filesLoading, refetch: refetchFiles } = useFiles();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toast } = useToast();
  const files = queriedFiles as VaultFile[];
  const isLoading = summaryLoading || filesLoading;

  const handleUpload = async (fileData: { name: string; size: number; protection: string }) => {
    try {
      const created = await api<VaultFile>("/files", {
        method: "POST",
        body: JSON.stringify(fileData),
      });
      await refetchFiles();
      toast("success", "File Uploaded & Hashed", `Registered ${created.name} on MST Blockchain`);
    } catch (error) {
      toast("error", "Upload Failed", String(error));
    }
  };

  const handleDownload = async (file: VaultFile) => {
    try {
      const result = await api<{ content: string; hash: string }>(`/files/${file.id}/download`);
      toast("success", `Downloaded ${file.name}`, `Verified hash: ${result.hash.slice(0, 10)}...`);
    } catch (error) {
      toast("error", "Download Failed", String(error));
    }
  };

  const handleVerifyHash = async (file: VaultFile) => {
    try {
      const result = await api<{ verified: boolean }>(`/files/${file.id}/verify`, { method: "POST" });
      toast(result.verified ? "success" : "error", result.verified ? "Verification Passed" : "Verification Failed", "SHA-256 hash verification completed");
    } catch (error) {
      toast("error", "Verification Failed", String(error));
    }
  };

  const handleUpdateProtection = async (file: VaultFile, protection: string) => {
    try {
      await api(`/files/${file.id}/protection`, { method: "PUT", body: JSON.stringify({ protection }) });
      await refetchFiles();
      toast("success", "Protection Updated", `Set protection mode to ${protection}`);
    } catch (error) {
      toast("error", "Protection Update Failed", String(error));
    }
  };

  const integrityFile = files[0];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-[14px] bg-canvas border border-hairline">
        <div>
          <h2 className="text-xl font-bold text-ink flex items-center gap-2">Enterprise Blockchain Document Storage</h2>
          <p className="text-xs text-ink-muted-48 mt-1 max-w-xl font-normal leading-relaxed">
            OverVault maintains end-to-end encrypted file privacy while committing SHA-256 proof digests to MST Blockchain for auditability.
          </p>
        </div>
        <Button size="md" variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setIsUploadOpen(true)} className="shrink-0">
          Upload Document
        </Button>
      </div>

      <SummaryCards summary={summary} isLoading={isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Recent Documents</h3>
            <Link href="/files"><Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>View All Vault Files</Button></Link>
          </div>
          <FileTable files={files.slice(0, 5)} isLoading={isLoading} onSelectFile={(file) => { setSelectedFile(file); setDrawerOpen(true); }} onDownload={handleDownload} />
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Blockchain Integrity</h3>
          <Card className="border-hairline">
            <CardHeader><CardTitle className="text-sm text-ink font-semibold">MST Testnet Verification Status</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-[10px] bg-parchment border border-hairline"><span className="text-ink-muted-48">Network Status</span><span className="font-mono text-success font-semibold flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-success" />Active</span></div>
              <div className="flex items-center justify-between p-3 rounded-[10px] bg-parchment border border-hairline"><span className="text-ink-muted-48">Chain Contract</span><span className="font-mono text-primary">0xOverVault...3a11</span></div>
              <div className="p-3 rounded-[10px] bg-primary/10 border border-primary/20 text-ink space-y-1"><span className="font-semibold text-primary block">Outbox Worker Sync</span><p className="text-[11px] text-ink-muted-80">Batch worker draining audit outbox events automatically every 30 seconds.</p></div>
            </CardContent>
          </Card>
          {integrityFile && <IntegrityWidget hash={integrityFile.hash} txHash={integrityFile.ownership_tx ?? null} verification={verificationState(integrityFile.verification)} />}
        </div>
      </div>

      <UploadDropzoneModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUpload={handleUpload} />
      <FileDrawer file={selectedFile} isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} onDownload={handleDownload} onVerifyHash={handleVerifyHash} onUpdateProtection={handleUpdateProtection} />
    </div>
  );
}
