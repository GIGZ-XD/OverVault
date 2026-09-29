"use client";
import React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Download } from "lucide-react";

export interface AuditFilterValues {
  search: string;
  eventType: string;
  verification: string;
}

export interface AuditFiltersProps {
  filters: AuditFilterValues;
  onFiltersChange: (filters: AuditFilterValues) => void;
  onRefresh: () => void;
  onExportCSV: () => void;
  totalEvents: number;
}

const EVENT_TYPE_OPTIONS = [
  { label: "All Event Types", value: "all" },
  { label: "Ownership Registered", value: "ownership_register" },
  { label: "Version Update", value: "version_update" },
  { label: "Access Granted", value: "access_grant" },
  { label: "Access Revoked", value: "access_revoke" },
  { label: "Hash Verification", value: "hash_verification" },
  { label: "Protection Changed", value: "protection_change" },
  { label: "Approval Submitted", value: "approval_submitted" },
  { label: "Approval Decision", value: "approval_decision" },
  { label: "File Download", value: "file_download" },
];

const VERIFICATION_OPTIONS = [
  { label: "All Statuses", value: "all" },
  { label: "Verified", value: "verified" },
  { label: "Pending", value: "pending" },
  { label: "Tampered", value: "tampered" },
];

export function AuditFilters({
  filters,
  onFiltersChange,
  onRefresh,
  onExportCSV,
  totalEvents,
}: AuditFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-canvas p-3 rounded-[14px] border border-hairline">
        {/* Search */}
        <div className="flex-1 w-full">
          <Input
            pill
            placeholder="Search events by actor, document, or transaction..."
            leftIcon={<Search className="w-3.5 h-3.5 text-ink-muted-48" />}
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="text-xs h-8"
          />
        </div>

        {/* Event Type Filter */}
        <div className="w-52 shrink-0">
          <Select
            options={EVENT_TYPE_OPTIONS}
            value={filters.eventType}
            onChange={(e) => onFiltersChange({ ...filters, eventType: e.target.value })}
            className="text-xs h-8"
          />
        </div>

        {/* Verification Filter */}
        <div className="w-40 shrink-0">
          <Select
            options={VERIFICATION_OPTIONS}
            value={filters.verification}
            onChange={(e) => onFiltersChange({ ...filters, verification: e.target.value })}
            className="text-xs h-8"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onExportCSV}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            CSV
          </Button>
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center gap-2 text-[11px] text-ink-muted-48 font-mono px-1">
        <span>{totalEvents} event{totalEvents !== 1 ? "s" : ""} found</span>
      </div>
    </div>
  );
}

export default AuditFilters;
