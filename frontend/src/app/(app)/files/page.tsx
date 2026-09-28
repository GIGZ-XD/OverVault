"use client";
import React, { useState, useEffect } from "react";
import { FileTable, VaultFile } from "@/components/features/files/file-table";
import { UploadDropzoneModal } from "@/components/features/files/upload-dropzone";
import { FileDrawer } from "@/components/features/files/file-drawer";
import { GrantDialog } from "@/components/features/access/grant-dialog";
import { DocumentVersion } from "@/components/features/versions/version-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Plus, Search, RefreshCw } from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";

export default function FilesPage() {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [protectionFilter, setProtectionFilter] = useState("all");

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fileVersions, setFileVersions] = useState<DocumentVersion[]>([]);

  const [grantFile, setGrantFile] = useState<VaultFile | null>(null);
  const [isGrantOpen, setIsGrantOpen] = useState(false);

  const { toast } = useToast();

  const loadFiles = async () => {
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
    loadFiles();
  }, []);

  const handleSelectFile = async (file: VaultFile) => {
    setSelectedFile(file);
    setDrawerOpen(true);
    try {
      const versions = await api<DocumentVersion[]>(`/files/${file.id}/versions`).catch(() => []);
      setFileVersions(versions);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpload = async (fileData: { name: string; size: number; protection: string }) => {
    try {
      const created = await api<VaultFile>("/files", {
        method: "POST",
        body: JSON.stringify(fileData),
      });
      toast("success", "File Uploaded", `Registered ${created.name} in vault`);
      loadFiles();
    } catch (err) {
      toast("error", "Upload Failed", String(err));
    }
  };

  const handleDownload = async (file: VaultFile) => {
    try {
      const res = await api<{ content: string; hash: string }>(`/files/${file.id}/download`);
      toast("success", `Downloaded ${file.name}`, `SHA-256 Digest: ${res.hash}`);
    } catch (err) {
      toast("error", "Download Failed", String(err));
    }
  };

  const handleVerifyHash = async (file: VaultFile) => {
    try {
      const res = await api<{ verified: boolean }>(`/files/${file.id}/verify`, { method: "POST" });
      if (res.verified) {
        toast("success", "Hash Integrity Verified", `Local content hash matches MST Blockchain`);
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
      toast("success", "Protection Level Updated", `Protection set to ${protection}`);
      loadFiles();
    } catch (err) {
      toast("error", "Failed to Update Protection", String(err));
    }
  };

  const handleDeleteFile = async (file: VaultFile) => {
    try {
      await api(`/files/${file.id}`, { method: "DELETE" });
      toast("success", "File Deleted", `Removed ${file.name} from vault`);
      loadFiles();
    } catch (err) {
      toast("error", "Delete Failed", String(err));
    }
  };

  const handleGrantAccess = async (grantData: { grantee: string; permission: string; expires_at: string }) => {
    if (!grantFile) return;
    try {
      await api(`/files/${grantFile.id}/permissions`, {
        method: "POST",
        body: JSON.stringify(grantData),
      });
      toast("success", "Permission Granted", `Issued ${grantData.permission} grant to ${grantData.grantee}`);
    } catch (err) {
      toast("error", "Grant Failed", String(err));
    }
  };

  const handleRollbackVersion = async (version: DocumentVersion) => {
    if (!selectedFile) return;
    try {
      await api(`/files/${selectedFile.id}/versions/${version.version}/rollback`, {
        method: "POST",
      });
      toast("success", "Version Rolled Back", `Reverted ${selectedFile.name} to v${version.version}`);
      loadFiles();
    } catch (err) {
      toast("error", "Rollback Failed", String(err));
    }
  };

  // Filtering
  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProtection = protectionFilter === "all" || f.protection === protectionFilter;
    return matchesSearch && matchesProtection;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink tracking-tight">Document Vault</h2>
          <p className="text-xs text-ink-muted-48 mt-0.5 font-normal">
            Manage encrypted enterprise documents with on-chain cryptographic proof tags.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsUploadOpen(true)}
        >
          Upload Document
        </Button>
      </div>

      {/* Search & Filter Bar — Apple 14px card surface */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-canvas p-3 rounded-[14px] border border-hairline">
        <div className="flex-1 w-full">
          <Input
            pill
            placeholder="Filter documents by title, hash, or owner..."
            leftIcon={<Search className="w-3.5 h-3.5 text-ink-muted-48" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs h-8"
          />
        </div>

        <div className="w-48 shrink-0">
          <Select
            options={[
              { label: "All Protection Modes", value: "all" },
              { label: "Read-Only Mode", value: "read-only" },
              { label: "Append-Only Mode", value: "append-only" },
              { label: "Standard / None", value: "none" },
            ]}
            value={protectionFilter}
            onChange={(e) => setProtectionFilter(e.target.value)}
            className="text-xs h-8"
          />
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={loadFiles}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {/* Files Data Table */}
      <FileTable
        files={filteredFiles}
        isLoading={isLoading}
        onSelectFile={handleSelectFile}
        onDownload={handleDownload}
        onDelete={handleDeleteFile}
        onGrantAccess={(f) => {
          setGrantFile(f);
          setIsGrantOpen(true);
        }}
      />

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
        versions={fileVersions}
        onDownload={handleDownload}
        onVerifyHash={handleVerifyHash}
        onUpdateProtection={handleUpdateProtection}
        onRollbackVersion={handleRollbackVersion}
      />

      {/* Grant Access Modal */}
      <GrantDialog
        isOpen={isGrantOpen}
        onClose={() => setIsGrantOpen(false)}
        fileId={grantFile?.id}
        onGrant={handleGrantAccess}
      />
    </div>
  );
}
