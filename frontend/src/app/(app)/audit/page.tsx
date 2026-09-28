"use client";
import React, { useState, useEffect } from "react";
import { AuditTable, AuditEvent } from "@/components/features/audit/audit-table";
import { AuditFilters, AuditFilterValues } from "@/components/features/audit/audit-filters";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText, ShieldCheck, Clock, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<AuditFilterValues>({
    search: "",
    eventType: "all",
    verification: "all",
  });
  const { toast } = useToast();

  const loadAudit = async () => {
    setIsLoading(true);
    try {
      const data = await api<AuditEvent[]>("/audit");
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  // Client-side filtering
  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      filters.search === "" ||
      (e.file_name || "").toLowerCase().includes(filters.search.toLowerCase()) ||
      (e.actor_name || "").toLowerCase().includes(filters.search.toLowerCase()) ||
      e.actor.toLowerCase().includes(filters.search.toLowerCase()) ||
      e.file_id.toLowerCase().includes(filters.search.toLowerCase()) ||
      (e.tx_hash || "").toLowerCase().includes(filters.search.toLowerCase()) ||
      (e.detail || "").toLowerCase().includes(filters.search.toLowerCase());

    const matchesType = filters.eventType === "all" || e.event_type === filters.eventType;
    const matchesVerification = filters.verification === "all" || e.verification === filters.verification;

    return matchesSearch && matchesType && matchesVerification;
  });

  // Summary statistics
  const verifiedCount = events.filter((e) => e.verification === "verified").length;
  const pendingCount = events.filter((e) => e.verification === "pending").length;
  const tamperedCount = events.filter((e) => e.verification === "tampered").length;

  // Export CSV
  const handleExportCSV = () => {
    if (filteredEvents.length === 0) {
      toast("error", "No Data", "No events to export.");
      return;
    }

    const headers = ["ID", "Event Type", "File", "Actor", "Actor Name", "Tx Hash", "Verification", "Timestamp", "Detail"];
    const rows = filteredEvents.map((e) => [
      e.id,
      e.event_type,
      e.file_name || e.file_id,
      e.actor,
      e.actor_name || "",
      e.tx_hash || "",
      e.verification,
      new Date(e.timestamp * 1000).toISOString(),
      e.detail || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `overvault-audit-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast("success", "CSV Exported", `Exported ${filteredEvents.length} audit events`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-ink tracking-tight flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-primary" /> Audit Trail
        </h2>
        <p className="text-xs text-ink-muted-48 mt-0.5 font-normal">
          Tamper-proof chronological record of all document actions with on-chain verification links.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-hairline">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-[10px] bg-success/10 text-success border border-success/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-ink">{verifiedCount}</span>
              <span className="text-xs text-ink-muted-48 font-normal block">Verified on chain</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-hairline">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-[10px] bg-warning/10 text-warning border border-warning/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-ink">{pendingCount}</span>
              <span className="text-xs text-ink-muted-48 font-normal block">Pending confirmation</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-hairline">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-[10px] bg-danger/10 text-danger border border-danger/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-ink">{tamperedCount}</span>
              <span className="text-xs text-ink-muted-48 font-normal block">Integrity alerts</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <AuditFilters
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={loadAudit}
        onExportCSV={handleExportCSV}
        totalEvents={filteredEvents.length}
      />

      {/* Audit Events Table */}
      <AuditTable events={filteredEvents} isLoading={isLoading} />
    </div>
  );
}
