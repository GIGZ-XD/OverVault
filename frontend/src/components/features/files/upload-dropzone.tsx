"use client";
import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { UploadCloud, File, CheckCircle2, Shield, Lock } from "lucide-react";
import { formatBytes } from "@/lib/utils";

export interface UploadDropzoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (fileData: { name: string; size: number; protection: string; file?: File }) => Promise<void>;
}

export function UploadDropzoneModal({ isOpen, onClose, onUpload }: UploadDropzoneModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [protection, setProtection] = useState<string>("read-only");
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      await onUpload({
        name: selectedFile.name,
        size: selectedFile.size,
        protection: protection,
        file: selectedFile,
      });
      setSelectedFile(null);
      onClose();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Encrypted Vault Document"
      description="Files are client-hashed, stored in private storage, and registered on MST Blockchain."
      maxWidth="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!selectedFile}
            isLoading={isUploading}
            leftIcon={<Lock className="w-4 h-4" />}
          >
            Encrypt & Upload
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Apple Style Drop Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`relative border border-hairline rounded-[14px] p-8 flex flex-col items-center justify-center text-center transition-colors duration-150 cursor-pointer ${
            dragActive
              ? "border-primary bg-primary/5"
              : "bg-parchment hover:bg-parchment/80"
          }`}
        >
          <input
            type="file"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="p-3 rounded-full bg-canvas text-primary mb-3 border border-hairline">
            <UploadCloud className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold text-ink">
            Click to select or drag and drop document
          </p>
          <p className="text-xs text-ink-muted-48 mt-1 font-mono">
            PDF, DOCX, XLSX, TXT, JSON (Max 50MB)
          </p>
        </div>

        {/* Selected File Preview */}
        {selectedFile && (
          <div className="p-3.5 rounded-[10px] border border-hairline bg-canvas flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-[8px] bg-parchment text-primary border border-hairline">
                <File className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-ink block">{selectedFile.name}</span>
                <span className="text-xs text-ink-muted-48 font-mono">{formatBytes(selectedFile.size)}</span>
              </div>
            </div>
            <CheckCircle2 className="w-4 h-4 text-success" />
          </div>
        )}

        {/* Protection Mode Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-primary" /> Protection Mode
          </label>
          <Select
            options={[
              { label: "Read-Only (No edits allowed, rollback supported)", value: "read-only" },
              { label: "Append-Only (Only new versions can be appended)", value: "append-only" },
              { label: "Standard / None (Unrestricted edits)", value: "none" },
            ]}
            value={protection}
            onChange={(e) => setProtection(e.target.value)}
          />
          <p className="text-[11px] text-ink-muted-48 font-normal">
            Protection settings are enforced by smart contract rules on MST Blockchain.
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default UploadDropzoneModal;
