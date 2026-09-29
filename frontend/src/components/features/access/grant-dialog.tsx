"use client";
import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { KeyRound, Shield, Calendar, User } from "lucide-react";

export interface GrantDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGrant: (grantData: { fileId: string; grantee: string; permission: string; expires_at: string }) => Promise<void>;
  fileId?: string;
  files?: Array<{ id: string; name: string }>;
  users?: Array<{ id: string; name: string; role: string }>;
}

export function GrantDialog({
  isOpen,
  onClose,
  onGrant,
  fileId,
  files = [],
  users = [
    { id: "u2", name: "Ravi Kumar", role: "manager" },
    { id: "u3", name: "Meera Iyer", role: "admin" },
    { id: "u4", name: "Kiran Shah", role: "auditor" },
    { id: "u5", name: "Priya Nair", role: "employee" },
  ],
}: GrantDialogProps) {
  const [selectedFileId, setSelectedFileId] = useState(fileId || files[0]?.id || "f1");
  const [grantee, setGrantee] = useState(users[0]?.id || "u2");
  const [permission, setPermission] = useState("read");
  const [expiresAt, setExpiresAt] = useState("2026-12-31T00:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync selectedFileId when files or fileId prop changes
  React.useEffect(() => {
    if (fileId) setSelectedFileId(fileId);
    else if (files.length > 0 && !files.some((f) => f.id === selectedFileId)) {
      setSelectedFileId(files[0].id);
    }
  }, [fileId, files, selectedFileId]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onGrant({
        fileId: selectedFileId,
        grantee,
        permission,
        expires_at: new Date(expiresAt).toISOString(),
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Grant Document Access Permission"
      description="Issue cryptographic permission grant registered on MST Blockchain."
      maxWidth="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isLoading={isSubmitting}
            onClick={handleSubmit}
            leftIcon={<KeyRound className="w-4 h-4" />}
          >
            Issue Grant
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Select Target Document */}
        {files.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-primary" /> Target Document
            </label>
            <Select
              options={files.map((f) => ({
                label: `${f.name} (ID: ${f.id})`,
                value: f.id,
              }))}
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
            />
          </div>
        )}

        {/* Select Grantee */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-accent" /> Grantee User
          </label>
          <Select
            options={users.map((u) => ({
              label: `${u.name} (${u.role.toUpperCase()})`,
              value: u.id,
            }))}
            value={grantee}
            onChange={(e) => setGrantee(e.target.value)}
          />
        </div>

        {/* Select Permission Level */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-accent" /> Permission Tier
          </label>
          <Select
            options={[
              { label: "Read Access (View & Download)", value: "read" },
              { label: "Write Access (Edit & Upload New Version)", value: "write" },
              { label: "Manage Access (Full Governance & Revocation)", value: "manage" },
            ]}
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
          />
        </div>

        {/* Expiration Date */}
        <DatePicker
          label="Grant Expiry Timestamp"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
        <p className="text-[11px] text-ink-muted-48 italic">
          Permission grants automatically expire on-chain via the background worker.
        </p>
      </div>
    </Modal>
  );
}
