"use client";
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, FileCheck, Clock, KeyRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export interface DashboardSummary {
  total_files: number;
  verified_files: number;
  pending_approvals: number;
  active_permissions: number;
  integrity_score: string;
  blockchain_status: string;
}

export interface SummaryCardsProps {
  summary?: DashboardSummary;
  isLoading?: boolean;
}

export function SummaryCards({ summary, isLoading }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Apple Design System: Single accent (Action Blue), semantic status colors only for state
  const cards = [
    {
      title: "Protected Files",
      value: summary?.total_files ?? 2,
      subtext: `${summary?.verified_files ?? 1} Blockchain Verified`,
      icon: FileCheck,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
    },
    {
      title: "Pending Approvals",
      value: summary?.pending_approvals ?? 1,
      subtext: "Requires review",
      icon: Clock,
      iconColor: "text-warning",
      iconBg: "bg-warning/10",
    },
    {
      title: "Active Grants",
      value: summary?.active_permissions ?? 1,
      subtext: "Scoped user permissions",
      icon: KeyRound,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
    },
    {
      title: "Vault Integrity",
      value: summary?.integrity_score ?? "100%",
      subtext: summary?.blockchain_status ?? "MST Testnet Connected",
      icon: ShieldCheck,
      iconColor: "text-success",
      iconBg: "bg-success/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card
            key={idx}
            className="group hover:border-primary/40 transition-all duration-150 active:scale-[0.98] select-none"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-muted-48">{card.title}</span>
                <div className={`p-2 rounded-[10px] ${card.iconBg} ${card.iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-ink tracking-tight">
                  {card.value}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-muted-48 font-mono">{card.subtext}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default SummaryCards;
