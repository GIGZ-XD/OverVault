"use client";
import React, { useState } from "react";
import { StorageNode } from "@/lib/api/hooks/useNodes";
import { Server, Activity, HardDrive, Shield, Wifi, Globe2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface NetworkTopologyProps {
  nodes: StorageNode[];
  onSelectNode: (node: StorageNode) => void;
}

export function NetworkTopology({ nodes, onSelectNode }: NetworkTopologyProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Position nodes in an interactive circular/constellation topology
  const centerX = 360;
  const centerY = 200;
  const radius = 130;

  const nodePositions = nodes.map((node, index) => {
    const angle = (index / (nodes.length || 1)) * 2 * Math.PI - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    return { ...node, x, y };
  });

  return (
    <div className="relative w-full rounded-[16px] border border-hairline bg-canvas/70 backdrop-blur-md overflow-hidden p-4 shadow-sm select-none">
      {/* Header Overlay */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-3 border-b border-hairline">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[8px] bg-primary/10 text-primary flex items-center justify-center">
            <Globe2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">Decentralized Mesh Topology</h3>
            <p className="text-[11px] text-ink-muted-48">
              P2P replication mesh with cryptographic verifiable state
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-parchment border border-hairline text-ink">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Mesh Quorum: 100% Healthy
          </span>
        </div>
      </div>

      {/* SVG Canvas Topology Graph */}
      <div className="relative h-[400px] w-full flex items-center justify-center overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 720 400">
          <defs>
            {/* Center Core Glow */}
            <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0071E3" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0071E3" stopOpacity="0" />
            </radialGradient>

            {/* Mesh Link Gradients */}
            <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0071E3" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#34C759" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          {/* Central MST Verification Hub */}
          <circle cx={centerX} cy={centerY} r="70" fill="url(#centerGlow)" />
          <circle
            cx={centerX}
            cy={centerY}
            r="38"
            className="fill-parchment stroke-primary stroke-[1.5] shadow-lg"
          />
          <text
            x={centerX}
            y={centerY - 6}
            textAnchor="middle"
            className="text-[10px] font-bold fill-ink tracking-wider font-mono"
          >
            MST VAULT
          </text>
          <text
            x={centerX}
            y={centerY + 10}
            textAnchor="middle"
            className="text-[9px] fill-primary font-mono uppercase font-semibold"
          >
            Quorum Core
          </text>

          {/* Mesh Interconnect Lines */}
          {nodePositions.map((n1, i) =>
            nodePositions.map((n2, j) => {
              if (i < j) {
                const isN1Syncing = n1.status === "syncing" || n2.status === "syncing";
                return (
                  <g key={`${n1.id}-${n2.id}`}>
                    <line
                      x1={n1.x}
                      y1={n1.y}
                      x2={n2.x}
                      y2={n2.y}
                      className="stroke-hairline"
                      strokeWidth="1.5"
                      strokeDasharray={isN1Syncing ? "4 4" : "none"}
                    />
                    {/* Live animated data pulse dot */}
                    <circle r="2.5" fill="#0071E3" className="opacity-80">
                      <animateMotion
                        path={`M ${n1.x} ${n1.y} L ${n2.x} ${n2.y}`}
                        dur={`${4 + (i + j)}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                );
              }
              return null;
            })
          )}

          {/* Lines from Center to Each Node */}
          {nodePositions.map((node) => (
            <line
              key={`center-${node.id}`}
              x1={centerX}
              y1={centerY}
              x2={node.x}
              y2={node.y}
              className="stroke-primary/20"
              strokeWidth="1"
            />
          ))}

          {/* Render Interactive Node Glyphs */}
          {nodePositions.map((node) => {
            const isSelected = selectedId === node.id;
            const isOnline = node.status === "online";
            const isSyncing = node.status === "syncing";
            const statusColor = isOnline ? "#34C759" : isSyncing ? "#FF9F0A" : "#FF3B30";

            return (
              <g
                key={node.id}
                className="cursor-pointer transition-all duration-200"
                onClick={() => {
                  setSelectedId(node.id);
                  onSelectNode(node);
                }}
              >
                {/* Node Halo */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isSelected ? 32 : 26}
                  fill={isSelected ? "rgba(0, 113, 227, 0.15)" : "transparent"}
                  stroke={isSelected ? "#0071E3" : "transparent"}
                  strokeWidth="2"
                  className="transition-all duration-150"
                />

                {/* Node Circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="20"
                  className="fill-canvas stroke-hairline"
                  strokeWidth="2"
                />

                {/* Node Status Indicator Dot */}
                <circle
                  cx={node.x + 13}
                  cy={node.y - 13}
                  r="5"
                  fill={statusColor}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />

                {/* Center Icon text */}
                <text
                  x={node.x}
                  y={node.y + 4}
                  textAnchor="middle"
                  className="text-[10px] font-mono font-bold fill-ink select-none pointer-events-none"
                >
                  {node.region.split(" ")[0]}
                </text>

                {/* Node Name Label Below */}
                <text
                  x={node.x}
                  y={node.y + 36}
                  textAnchor="middle"
                  className={`text-[11px] font-semibold ${isSelected ? "fill-primary font-bold" : "fill-ink"} pointer-events-none`}
                >
                  {node.name.length > 18 ? node.name.slice(0, 16) + "..." : node.name}
                </text>

                {/* Node Capacity Subtext */}
                <text
                  x={node.x}
                  y={node.y + 49}
                  textAnchor="middle"
                  className="text-[9px] font-mono fill-ink-muted-48 pointer-events-none"
                >
                  {node.used_storage_gb}GB / {node.allocated_storage_gb}GB ({node.latency_ms}ms)
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-hairline text-xs">
        <div className="flex items-center gap-4 text-ink-muted-80">
          <span className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-success" /> Online & Verified
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-warning" /> Replicating / Syncing
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-danger" /> Draining / Offline
          </span>
        </div>
        <span className="text-[11px] text-ink-muted-48 italic">
          Click on any node to inspect chunk telemetry & storage allocation
        </span>
      </div>
    </div>
  );
}
