"use client";
import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { User, Shield, Cpu, Database, RefreshCw, Key, CheckCircle2 } from "lucide-react";
import { config } from "@/lib/config";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";

export default function SettingsPage() {
  const [apiMode, setApiMode] = useState(config.apiMode);
  const [walletMode, setWalletMode] = useState(config.walletMode);
  const [apiUrl, setApiUrl] = useState(config.apiUrl);
  const [isTestingHealth, setIsTestingHealth] = useState(false);
  const [healthResult, setHealthResult] = useState<string | null>(null);

  // Active user identity
  const [activeUser, setActiveUser] = useState("u1");

  const { toast } = useToast();

  const users = [
    { id: "u1", name: "Asha Rao", role: "employee", wallet: "0xaaa128b94f09c21e" },
    { id: "u2", name: "Ravi Kumar", role: "manager", wallet: "0xbbb219cf8821a74d" },
    { id: "u3", name: "Meera Iyer", role: "admin", wallet: "0xccc394aa5190b392" },
    { id: "u4", name: "Kiran Shah", role: "auditor", wallet: "0xddd4301be67210e1" },
  ];

  const currentUser = users.find((u) => u.id === activeUser) || users[0];

  const handleTestHealth = async () => {
    setIsTestingHealth(true);
    try {
      const res = await api<{ status: string }>("/health");
      setHealthResult(res.status || "ok");
      toast("success", "Backend Health OK", "Connected to OverVault API service");
    } catch (err) {
      setHealthResult("Error connecting");
      toast("error", "Health Check Failed", String(err));
    } finally {
      setIsTestingHealth(false);
    }
  };

  const handleSaveConfig = () => {
    toast("success", "Configuration Saved", "Updated API & wallet preferences.");
  };

  const handleSwitchUser = (userId: string) => {
    setActiveUser(userId);
    const u = users.find((item) => item.id === userId);
    toast("success", "Active User Switched", `Now viewing vault as ${u?.name} (${u?.role})`);
  };

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-ink tracking-tight">Settings & Identity</h2>
        <p className="text-xs text-ink-muted-48 mt-0.5 font-normal">
          Manage your enterprise user identity, API routing, and cryptographic verification preferences.
        </p>
      </div>

      <div className="space-y-6">
        {/* Card 1: Enterprise User Profile & Cryptographic Identity */}
        <Card id="profile">
          <CardHeader>
            <CardTitle>
              <User className="w-4 h-4 text-primary" /> User Profile & Identity
            </CardTitle>
            <CardDescription>
              Authenticated cryptographic identity and role-based access control profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-[12px] bg-parchment border border-hairline">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base shadow-none">
                  {currentUser.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-ink">{currentUser.name}</span>
                    <Badge variant="verified">{currentUser.role}</Badge>
                  </div>
                  <span className="text-xs text-ink-muted-48 font-mono block mt-0.5">
                    User ID: {currentUser.id} • Wallet: {currentUser.wallet}
                  </span>
                </div>
              </div>

              <div className="w-48 shrink-0">
                <label className="text-[11px] font-semibold text-ink-muted-48 block mb-1">
                  Switch Active Identity
                </label>
                <Select
                  options={users.map((u) => ({
                    label: `${u.name} (${u.role})`,
                    value: u.id,
                  }))}
                  value={activeUser}
                  onChange={(e) => handleSwitchUser(e.target.value)}
                  className="text-xs h-8"
                />
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
                <span className="text-ink-muted-48 font-normal block">Key Status</span>
                <span className="font-semibold text-success flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Hardware Protected
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: API & Environment Config */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Database className="w-4 h-4 text-primary" /> API & Service Mode
            </CardTitle>
            <CardDescription>Configure backend routing (MSW mock vs FastAPI real server).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="API Backend Mode"
                options={[
                  { label: "Mock Mode (MSW Browser Interceptor)", value: "mock" },
                  { label: "Real Mode (FastAPI Backend Server)", value: "real" },
                ]}
                value={apiMode}
                onChange={(e) => setApiMode(e.target.value)}
              />

              <Select
                label="Wallet Adapter Mode"
                options={[
                  { label: "Mock Adapter (Dev Testing)", value: "mock" },
                  { label: "BridgeKey Extension (Chrome Extension)", value: "bridgekey" },
                ]}
                value={walletMode}
                onChange={(e) => setWalletMode(e.target.value)}
              />
            </div>

            <Input
              label="FastAPI Backend URL"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8000"
            />

            <div className="flex items-center gap-3 pt-2">
              <Button size="sm" variant="primary" onClick={handleSaveConfig}>
                Save Settings
              </Button>
              <Button
                size="sm"
                variant="secondary"
                isLoading={isTestingHealth}
                onClick={handleTestHealth}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Test Health Endpoint
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
            <CardDescription>Network details and contract address references.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="p-3.5 rounded-[10px] border border-hairline bg-parchment font-mono space-y-2">
              <div className="flex justify-between">
                <span className="text-ink-muted-48 font-normal">Target Network</span>
                <span className="text-success font-semibold">MST Testnet</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted-48 font-normal">Chain ID</span>
                <span className="text-ink font-normal">98214</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted-48 font-normal">Explorer URL</span>
                <span className="text-primary font-normal">https://mstscan.io</span>
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
                AES-256 GCM client-side encryption and SHA-256 hash hashing enabled by default.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
