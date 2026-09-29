"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, Shield, Cpu, Database, RefreshCw, CheckCircle2, LogOut, KeyRound } from "lucide-react";
import { config } from "@/lib/config";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { clearToken } from "@/lib/api/token";
import { useMe } from "@/lib/api/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { shortHash } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState(config.apiUrl);
  const [isTestingHealth, setIsTestingHealth] = useState(false);
  const [healthResult, setHealthResult] = useState<string | null>(null);

  const { data: meUser, isLoading } = useMe();
  const qc = useQueryClient();
  const { toast } = useToast();

  const displayName = meUser?.name || "Vault Operator";
  const displayRole = meUser?.role || "operator";
  const displayWallet = meUser?.wallet_address || "0xaaa1";
  const displayEmail = meUser?.email || "operator@overvault.enterprise";
  const displayInitials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleTestHealth = async () => {
    setIsTestingHealth(true);
    try {
      const res = await api<{ status: string }>("/health");
      setHealthResult(res.status || "ok");
      toast("success", "Backend Health OK", "Connected to live OverVault API service");
    } catch (err) {
      setHealthResult("Error connecting");
      toast("error", "Health Check Failed", String(err));
    } finally {
      setIsTestingHealth(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    qc.clear();
    toast("info", "Disconnected", "You have been logged out of the vault.");
    router.replace("/login");
  };

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink tracking-tight">Settings & Security</h2>
          <p className="text-xs text-ink-muted-48 mt-0.5 font-normal">
            Manage your cryptographic identity, connected wallet, and blockchain network parameters.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="text-xs text-danger hover:text-danger hover:bg-danger/10 border-danger/20 w-fit"
          leftIcon={<LogOut className="w-3.5 h-3.5" />}
        >
          Disconnect Wallet & Log Out
        </Button>
      </div>

      <div className="space-y-6">
        {/* Card 1: Enterprise User Profile & Cryptographic Identity */}
        <Card id="profile">
          <CardHeader>
            <CardTitle>
              <User className="w-4 h-4 text-primary" /> Authenticated Profile & Wallet
            </CardTitle>
            <CardDescription>
              Your verified cryptographic identity and role-based access control tier.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-[12px] bg-parchment border border-hairline">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base shadow-sm">
                  {displayInitials}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-ink">{displayName}</span>
                    <Badge variant="verified">{displayRole.toUpperCase()}</Badge>
                  </div>
                  <span className="text-xs text-ink-muted-48 font-mono block mt-0.5">
                    {displayEmail} • Connected Wallet: {shortHash(displayWallet)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-mono font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  Wallet Connected
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-[10px] bg-canvas border border-hairline space-y-1">
                <span className="text-ink-muted-48 font-normal block">Organization</span>
                <span className="font-semibold text-ink">OverVault Enterprise</span>
              </div>
              <div className="p-3 rounded-[10px] bg-canvas border border-hairline space-y-1">
                <span className="text-ink-muted-48 font-normal block">Signature Mode</span>
                <span className="font-mono text-primary font-normal">ECDSA (secp256k1)</span>
              </div>
              <div className="p-3 rounded-[10px] bg-canvas border border-hairline space-y-1">
                <span className="text-ink-muted-48 font-normal block">Security Standard</span>
                <span className="font-semibold text-success flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Hardware / Web3 Verified
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Vault Infrastructure & Connectivity */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Database className="w-4 h-4 text-primary" /> Vault Infrastructure & API Service
            </CardTitle>
            <CardDescription>Live backend service connectivity and health telemetry.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="FastAPI Backend Endpoint"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8000"
            />

            <div className="flex items-center gap-3 pt-1">
              <Button
                size="sm"
                variant="secondary"
                isLoading={isTestingHealth}
                onClick={handleTestHealth}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Test Service Health
              </Button>

              {healthResult && (
                <Badge variant={healthResult === "ok" ? "verified" : "tampered"}>
                  Status: {healthResult}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Smart Contract & Blockchain */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Cpu className="w-4 h-4 text-primary" /> MST Blockchain Parameters
            </CardTitle>
            <CardDescription>Active blockchain network details and cryptographic registry.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="p-3.5 rounded-[10px] border border-hairline bg-parchment font-mono space-y-2">
              <div className="flex justify-between">
                <span className="text-ink-muted-48 font-normal">Target Network</span>
                <span className="text-success font-semibold">MST Blockchain Testnet</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted-48 font-normal">Chain ID</span>
                <span className="text-ink font-semibold">91562037</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted-48 font-normal">Explorer URL</span>
                <a
                  href="https://mstscan.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-normal"
                >
                  https://mstscan.io
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Security & Encryption */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Shield className="w-4 h-4 text-primary" /> Security & Protection Defaults
            </CardTitle>
            <CardDescription>Default document protection and encryption settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center gap-2.5 p-3 rounded-[10px] bg-primary/10 border border-primary/20 text-ink">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span className="font-normal">
                AES-256 GCM client-side encryption and SHA-256 cryptographic digest hashing enabled across all vaults.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
