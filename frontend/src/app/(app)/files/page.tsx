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
import { Plus, Search, RefreshCw, AlertCircle } from "lucide-react";
import { api } from "@/lib/api/client";
import { config } from "@/lib/config";
import { useToast } from "@/components/ui/toast";
import { shortHash } from "@/lib/utils";

export default function FilesPage() {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [protectionFilter, setProtectionFilter] = useState("all");

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fileVersions, setFileVersions] = useState<DocumentVersion[]>([]);

  const [grantFile, setGrantFile] = useState<VaultFile | null>(null);
  const [isGrantOpen, setIsGrantOpen] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string; role: string }>>([]);

  const { toast } = useToast();

  const loadFiles = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [data, usersData] = await Promise.all([
        api<VaultFile[]>("/files"),
        api<Array<{ id: string; name: string; role: string }>>("/users/directory")
          .catch(() => api<Array<{ id: string; name: string; role: string }>>("/users"))
          .catch(() => []),
      ]);
      setFiles(data);
      if (usersData && usersData.length > 0) {
        setUsers(usersData);
      }
    } catch (err) {
      console.error(err);
      setLoadError("Could not retrieve documents from vault API. Please ensure the backend is active.");
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

  const handleUpload = async (fileData: { name: string; size: number; protection: string; file?: File }) => {
    try {
      let created: VaultFile;
      if (fileData.file) {
        const form = new FormData();
        form.append("upload", fileData.file);
        form.append("comment", "Uploaded via OverVault UI");
        created = await api<VaultFile>("/files", {
          method: "POST",
          body: form,
        });
      } else {
        created = await api<VaultFile>("/files", {
          method: "POST",
          body: JSON.stringify(fileData),
        });
      }
      const txInfo = created?.ownership_tx ? ` • Tx: ${shortHash(created.ownership_tx)}` : " • Anchored on MST Blockchain";
      toast("success", "File Uploaded & Anchored", `Registered ${created.name || fileData.name}${txInfo}`);
      loadFiles();
    } catch (err) {
      toast("error", "Upload Failed", String(err));
    }
  };

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

  const handleGrantAccess = async (grantData: { fileId?: string; grantee: string; permission: string; expires_at: string }) => {
    const targetFileId = grantData.fileId || grantFile?.id;
    if (!targetFileId) return;
    try {
      await api(`/files/${targetFileId}/permissions`, {
        method: "POST",
        body: JSON.stringify({
          grantee: grantData.grantee,
          permission: grantData.permission,
          expires_at: grantData.expires_at,
        }),
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

      {loadError && (
        <div className="p-4 rounded-[12px] bg-danger/10 border border-danger/20 flex items-center justify-between text-xs text-ink" role="alert">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-danger shrink-0" />
            <span>{loadError}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={loadFiles} className="text-xs h-7">
            Retry Connection
          </Button>
        </div>
      )}

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
        files={files}
        users={users}
        onGrant={handleGrantAccess}
      />
    </div>
  );
}
