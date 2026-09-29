"use client";
import React from "react";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shortHash, formatDate } from "@/lib/utils";
import { GitCommit, RotateCcw, ShieldCheck, FileCheck } from "lucide-react";

export interface DocumentVersion {
  file_id: string;
  version: number;
  author: string;
  created_at: string;
  hash: string;
  verification: string;
}

export interface VersionTimelineProps {
  versions: DocumentVersion[];
  currentVersion?: number;
  onRollback?: (version: DocumentVersion) => void;
  isLoading?: boolean;
}

export function VersionTimeline({ versions, currentVersion, onRollback, isLoading }: VersionTimelineProps) {
  if (isLoading) {
    return <div className="p-4 text-xs text-ink-muted-48 animate-pulse">Loading version history...</div>;
  }

  if (!versions || versions.length === 0) {
    return <div className="text-xs text-ink-muted-48 italic py-2">No version history available.</div>;
  }

  // Sort versions descending
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

  const timelineItems: TimelineItem[] = sortedVersions.map((v) => {
    const isCurrent = currentVersion ? v.version === currentVersion : v === sortedVersions[0];

    return {
      id: `v-${v.version}`,
      title: (
        <span className="flex items-center gap-2">
          <span>Version {v.version}</span>
          {isCurrent && <Badge variant="accent">Active</Badge>}
        </span>
      ),
      timestamp: formatDate(v.created_at),
      badge: <Badge variant={v.verification === "verified" ? "verified" : "pending"}>{v.verification}</Badge>,
      description: (
        <div className="space-y-2 mt-1">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-ink-muted-48">Author: {v.author}</span>
            <span className="text-ink-muted-48">•</span>
            <span className="text-ink-muted-48 bg-parchment px-1.5 py-0.5 rounded border border-border/40">
              {shortHash(v.hash)}
            </span>
          </div>

          {!isCurrent && onRollback && (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => onRollback(v)}
              className="text-xs h-7 py-1 px-2.5"
            >
              Rollback to v{v.version}
            </Button>
          )}
        </div>
      ),
      icon: <GitCommit className="w-3.5 h-3.5 text-accent" />,
    };
  });

  return <Timeline items={timelineItems} />;
}
