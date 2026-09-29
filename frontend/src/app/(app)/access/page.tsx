"use client";
import React, { useState, useEffect } from "react";
import { GrantsTable, PermissionGrant } from "@/components/features/access/grants-table";
import { GrantDialog } from "@/components/features/access/grant-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KeyRound, Plus, Users, Shield, RefreshCw, UserCheck, AlertCircle } from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";

export default function AccessPage() {
  const [grants, setGrants] = useState<PermissionGrant[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string; role: string; wallet: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isGrantOpen, setIsGrantOpen] = useState(false);
  const { toast } = useToast();

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [grantsData, usersData] = await Promise.all([
        api<PermissionGrant[]>("/files/f1/permissions").catch(() => []),
        api<Array<any>>("/users").catch(() => []),
      ]);
      setGrants(grantsData);
      setUsers(usersData);
    } catch (err) {
      console.error(err);
      setLoadError("Failed to fetch access control directory and grants from API.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGrant = async (grantData: { grantee: string; permission: string; expires_at: string }) => {
    try {
      await api("/files/f1/permissions", {
        method: "POST",
        body: JSON.stringify(grantData),
      });
      toast("success", "Permission Issued", `Granted ${grantData.permission} to ${grantData.grantee}`);
      loadData();
    } catch (err) {
      toast("error", "Grant Failed", String(err));
    }
  };

  const handleRevoke = async (grant: PermissionGrant) => {
    try {
      await api(`/permissions/${grant.id}`, { method: "DELETE" });
      toast("success", "Permission Revoked", `Revoked grant #${grant.id}`);
      loadData();
    } catch (err) {
      toast("error", "Revocation Failed", String(err));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">Access Control & Role Grants</h2>
          <p className="text-xs text-ink-muted-48 mt-0.5">
            Cryptographically enforced document permission grants with automatic expiration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          <Button
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsGrantOpen(true)}
          >
            Grant Access
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="p-4 rounded-[12px] bg-danger/10 border border-danger/20 flex items-center justify-between text-xs text-ink" role="alert">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-danger shrink-0" />
            <span>{loadError}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={loadData} className="text-xs h-7">
            Retry Connection
          </Button>
        </div>
      )}

      {/* Users Directory Quick Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {users.map((u) => (
          <Card key={u.id} className="bg-parchment">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent-soft text-accent flex items-center justify-center font-bold text-sm font-mono border border-accent/20">
                {u.id.toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <span className="text-sm font-semibold text-ink block truncate">{u.name}</span>
                <span className="text-xs text-ink-muted-48 font-mono uppercase tracking-wider block">
                  {u.role}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Grants Table */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-ink flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-accent" /> Active Document Grants
        </h3>
        <GrantsTable grants={grants} isLoading={isLoading} onRevoke={handleRevoke} />
      </div>

      {/* Grant Dialog Modal */}
      <GrantDialog
        isOpen={isGrantOpen}
        onClose={() => setIsGrantOpen(false)}
        fileId="f1"
        users={users}
        onGrant={handleGrant}
      />
    </div>
  );
}
