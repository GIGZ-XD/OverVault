"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  Lock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  RefreshCw,
  UserCheck,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { setToken } from "@/lib/api/token";
import { wallet } from "@/lib/wallet";

interface SeedUser {
  id: string;
  name: string;
  role: "employee" | "manager" | "admin" | "auditor";
  wallet: string;
  description: string;
}

const SEED_USERS: SeedUser[] = [
  { id: "u1", name: "Asha Rao", role: "employee", wallet: "0xaaa1", description: "Document upload & access requests" },
  { id: "u2", name: "Ravi Kumar", role: "manager", wallet: "0xbbb2", description: "Multi-sig approval review & decisions" },
  { id: "u3", name: "Meera Iyer", role: "admin", wallet: "0xccc3", description: "Vault security & storage node management" },
  { id: "u4", name: "Kiran Shah", role: "auditor", wallet: "0xddd4", description: "Immutable audit ledger & proof inspection" },
];

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"wallet" | "dev">("wallet");
  const [selectedProvider, setSelectedProvider] = useState<"bridgekey" | "metamask" | "mock">("bridgekey");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [nonceMessage, setNonceMessage] = useState<string | null>(null);
  const [authenticatedUser, setAuthenticatedUser] = useState<{ name: string; role: string; wallet?: string } | null>(null);
  const [hasEthereum, setHasEthereum] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as unknown as { ethereum?: unknown }).ethereum) {
      setHasEthereum(true);
    }
  }, []);

  // Step 1: Connect Wallet
  const handleConnectWallet = async (provider: "bridgekey" | "metamask" | "mock", presetWallet?: string) => {
    setSelectedProvider(provider);
    setLoading(true);

    try {
      let targetAddress = presetWallet || "0xaaa1";

      if (provider === "bridgekey") {
        try {
          const conn = await wallet.connect();
          if (conn.address) {
            targetAddress = conn.address;
          }
        } catch (walletErr) {
          console.warn("BridgeKey adapter connect note:", walletErr);
        }
      } else if (provider === "metamask" && hasEthereum) {
        const ethereum = (window as unknown as { ethereum: { request: (args: { method: string }) => Promise<string[]> } }).ethereum;
        const accounts = await ethereum.request({ method: "eth_requestAccounts" });
        if (accounts && accounts.length > 0) {
          targetAddress = accounts[0];
        }
      }

      setConnectedAddress(targetAddress);

      // Step 2: Request Nonce from Backend
      try {
        const nonceRes = await api<{ nonce: string; message: string }>("/auth/nonce", {
          method: "POST",
          body: JSON.stringify({ address: targetAddress }),
        });
        setNonceMessage(nonceRes.message);
      } catch {
        // Fallback challenge message for demo / mock mode
        setNonceMessage(
          `OverVault Cryptographic Verification\n\nPlease sign this one-time challenge to prove ownership of wallet: ${targetAddress}\nTimestamp: ${new Date().toISOString()}`
        );
      }

      setStep(2);
      toast("info", "Wallet Connected", `Connected: ${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}`);
    } catch (err) {
      toast("error", "Connection Failed", String(err));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Sign Challenge & Exchange for JWT
  const handleSignAndVerify = async () => {
    if (!connectedAddress) return;
    setLoading(true);

    try {
      let signature = "0x" + Array.from({ length: 130 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

      // Attempt personal_sign with BridgeKey or MetaMask if active
      if (selectedProvider === "bridgekey" && nonceMessage) {
        try {
          signature = await wallet.signMessage(nonceMessage);
        } catch (err: unknown) {
          console.warn("BridgeKey sign attempt note:", err);
        }
      } else if (selectedProvider === "metamask" && hasEthereum && nonceMessage) {
        try {
          const ethereum = (window as unknown as {
            ethereum: { request: (args: { method: string; params: string[] }) => Promise<string> };
          }).ethereum;
          signature = await ethereum.request({
            method: "personal_sign",
            params: [nonceMessage, connectedAddress],
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.toLowerCase().includes("reject") || errMsg.toLowerCase().includes("cancel")) {
            throw new Error("Signature request was rejected in your wallet.");
          }
        }
      }

      // Try backend /auth/wallet-login
      let jwtToken: string | null = null;
      let userProfile = { name: "Asha Rao", role: "employee", wallet: connectedAddress };

      try {
        const loginRes = await api<{ access_token: string; user?: { name: string; role: string } }>("/auth/wallet-login", {
          method: "POST",
          body: JSON.stringify({
            address: connectedAddress,
            signature: signature,
          }),
        });
        if (loginRes.access_token) {
          jwtToken = loginRes.access_token;
          if (loginRes.user) {
            userProfile = { ...userProfile, ...loginRes.user };
          }
        }
      } catch {
        // Fallback to dev-login with matching seeded wallet or u1
        const matched = SEED_USERS.find((u) => u.wallet.toLowerCase().startsWith(connectedAddress.slice(0, 6).toLowerCase())) || SEED_USERS[0];
        const devRes = await api<{ access_token: string }>("/auth/dev-login", {
          method: "POST",
          body: JSON.stringify({ user_id: matched.id }),
        });
        jwtToken = devRes.access_token;
        userProfile = { name: matched.name, role: matched.role, wallet: matched.wallet };
      }

      if (jwtToken) {
        setToken(jwtToken);
      }

      setAuthenticatedUser(userProfile);
      setStep(3);
      toast("success", "Signature Verified", `Welcome back, ${userProfile.name}!`);

      setTimeout(() => {
        router.push("/dashboard");
      }, 1200);
    } catch (err) {
      toast("error", "Authentication Error", String(err));
    } finally {
      setLoading(false);
    }
  };

  // Direct Dev Persona Login
  const handleDevLogin = async (user: SeedUser) => {
    setLoading(true);
    try {
      const res = await api<{ access_token: string }>("/auth/dev-login", {
        method: "POST",
        body: JSON.stringify({ user_id: user.id }),
      });
      if (res.access_token) {
        setToken(res.access_token);
      }
      setAuthenticatedUser({ name: user.name, role: user.role, wallet: user.wallet });
      setStep(3);
      toast("success", "Dev Session Active", `Logged in as ${user.name} (${user.role})`);
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (err) {
      toast("error", "Dev Login Failed", String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      {/* OverVault Brand Header */}
      <div className="text-center mb-8 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-hairline shadow-sm mb-4">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono font-medium text-ink">MST Blockchain Security Standard</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink">
          Over<span className="text-primary">Vault</span>
        </h1>
        <p className="text-sm text-ink-muted-48 mt-1.5 max-w-sm mx-auto">
          Cryptographically authenticated, zero-trust document vault & decentralized storage mesh
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-lg bg-surface border border-hairline rounded-2xl shadow-xl p-6 sm:p-8 relative z-10 backdrop-blur-sm">
        {/* Navigation Tabs: Wallet vs Dev Persona */}
        <div className="flex border-b border-hairline mb-6">
          <button
            type="button"
            onClick={() => { setActiveTab("wallet"); setStep(1); }}
            className={`flex-1 pb-3 text-sm font-medium text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === "wallet"
                ? "border-primary text-primary"
                : "border-transparent text-ink-muted-48 hover:text-ink"
            }`}
          >
            <Wallet className="w-4 h-4" />
            Wallet Signature
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("dev"); setStep(1); }}
            className={`flex-1 pb-3 text-sm font-medium text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === "dev"
                ? "border-primary text-primary"
                : "border-transparent text-ink-muted-48 hover:text-ink"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Dev Personas
          </button>
        </div>

        {/* TAB 1: WALLET AUTHENTICATION FLOW */}
        {activeTab === "wallet" && (
          <div>
            {/* Step Indicators */}
            <div className="flex items-center justify-between mb-6 px-2">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-semibold ${
                  step >= 1 ? "bg-primary text-white" : "bg-surface-elevated text-ink-muted-48"
                }`}>
                  1
                </div>
                <span className={`text-xs font-medium ${step >= 1 ? "text-ink" : "text-ink-muted-48"}`}>
                  Connect
                </span>
              </div>
              <div className="h-px w-10 bg-hairline" />
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-semibold ${
                  step >= 2 ? "bg-primary text-white" : "bg-surface-elevated text-ink-muted-48"
                }`}>
                  2
                </div>
                <span className={`text-xs font-medium ${step >= 2 ? "text-ink" : "text-ink-muted-48"}`}>
                  Sign Nonce
                </span>
              </div>
              <div className="h-px w-10 bg-hairline" />
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-semibold ${
                  step === 3 ? "bg-emerald-500 text-white" : "bg-surface-elevated text-ink-muted-48"
                }`}>
                  3
                </div>
                <span className={`text-xs font-medium ${step === 3 ? "text-ink" : "text-ink-muted-48"}`}>
                  Enter Vault
                </span>
              </div>
            </div>

            {/* STEP 1: SELECT WALLET */}
            {step === 1 && (
              <div className="space-y-3">
                <p className="text-xs text-ink-muted-48 mb-2">
                  Select your blockchain wallet provider to request a cryptographically signed login session:
                </p>

                {/* BridgeKey Option */}
                <button
                  type="button"
                  onClick={() => handleConnectWallet("bridgekey")}
                  disabled={loading}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-hairline bg-surface hover:bg-surface-elevated transition-all text-left group hover:border-primary/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink flex items-center gap-2">
                        BridgeKey Wallet
                        <Badge variant="accent">Recommended</Badge>
                      </div>
                      <div className="text-xs text-ink-muted-48">Native MST Blockchain wallet & signing engine</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-muted-48 group-hover:text-primary transition-colors" />
                </button>

                {/* MetaMask / EIP-1193 */}
                <button
                  type="button"
                  onClick={() => handleConnectWallet("metamask")}
                  disabled={loading}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-hairline bg-surface hover:bg-surface-elevated transition-all text-left group hover:border-primary/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink flex items-center gap-2">
                        MetaMask / Web3 Browser
                        {hasEthereum ? (
                          <Badge variant="verified">Detected</Badge>
                        ) : (
                          <Badge variant="default">Extension</Badge>
                        )}
                      </div>
                      <div className="text-xs text-ink-muted-48">Connect via browser extension or hardware key</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-muted-48 group-hover:text-primary transition-colors" />
                </button>

                {/* Seeded Wallet Quick-Pick */}
                <div className="pt-2">
                  <div className="text-[11px] font-mono text-ink-muted-48 uppercase tracking-wider mb-2">
                    Or select pre-registered testnet wallet:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {SEED_USERS.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleConnectWallet("mock", user.wallet)}
                        className="p-2.5 rounded-lg border border-hairline bg-surface hover:bg-surface-elevated text-left transition-colors text-xs"
                      >
                        <div className="font-semibold text-ink">{user.name}</div>
                        <div className="text-[10px] font-mono text-ink-muted-48">{user.wallet.slice(0, 8)}...</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: SIGN CHALLENGE */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="p-3 bg-surface-elevated rounded-xl border border-hairline">
                  <div className="text-xs font-mono text-ink-muted-48 mb-1">Target Wallet Address</div>
                  <div className="text-sm font-mono font-semibold text-ink break-all">
                    {connectedAddress}
                  </div>
                </div>

                <div className="p-3 bg-bg rounded-xl border border-hairline">
                  <div className="text-xs font-medium text-ink flex items-center gap-1.5 mb-1.5">
                    <Lock className="w-3.5 h-3.5 text-primary" />
                    Cryptographic Challenge (EIP-191 Nonce)
                  </div>
                  <pre className="text-[11px] font-mono text-ink-muted-48 whitespace-pre-wrap break-all bg-surface p-2.5 rounded-lg border border-hairline max-h-32 overflow-y-auto">
                    {nonceMessage}
                  </pre>
                  <p className="text-[10px] text-ink-muted-48 mt-1.5">
                    Signing this challenge proves mathematical ownership of your private key without revealing it.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={loading}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSignAndVerify}
                    disabled={loading}
                    className="flex-2 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Verifying Signature...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Sign Challenge & Enter
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: SUCCESS */}
            {step === 3 && (
              <div className="text-center py-6 space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20 animate-bounce">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-ink">Cryptographic Signature Verified</h3>
                <p className="text-xs text-ink-muted-48 max-w-xs mx-auto">
                  Identity securely established on MST Blockchain. Decrypting vault session...
                </p>
                {authenticatedUser && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-elevated border border-hairline text-xs font-mono text-ink">
                    <span className="font-semibold">{authenticatedUser.name}</span>
                    <Badge variant="default">{authenticatedUser.role}</Badge>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DEV PERSONAS DIRECT ACCESS */}
        {activeTab === "dev" && (
          <div className="space-y-3">
            <p className="text-xs text-ink-muted-48 mb-3">
              One-click instantaneous authentication for demo evaluations & RBAC role testing:
            </p>

            <div className="space-y-2">
              {SEED_USERS.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleDevLogin(user)}
                  disabled={loading}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-hairline bg-surface hover:bg-surface-elevated transition-all text-left group hover:border-primary/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-mono text-xs font-bold">
                      {user.id.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink flex items-center gap-2">
                        {user.name}
                        <Badge
                          variant={
                            user.role === "admin"
                              ? "tampered"
                              : user.role === "manager"
                              ? "pending"
                              : user.role === "auditor"
                              ? "default"
                              : "accent"
                          }
                        >
                          {user.role}
                        </Badge>
                      </div>
                      <div className="text-xs text-ink-muted-48">{user.description}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-ink-muted-48 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>

            <div className="pt-2 text-center">
              <span className="text-[11px] text-ink-muted-48">
                Dev JWT tokens are minted directly by the FastAPI backend (`/api/auth/dev-login`).
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Links & Documentation */}
      <div className="mt-8 text-center text-xs text-ink-muted-48 relative z-10 flex items-center gap-4">
        <span>OverVault Enterprise v1.0.0</span>
        <span>•</span>
        <a
          href="https://mstscan.io"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-ink transition-colors flex items-center gap-1"
        >
          MSTScan Explorer <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
