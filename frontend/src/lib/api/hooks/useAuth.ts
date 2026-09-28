"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { qk } from "../keys";
import { clearToken, setToken } from "../token";
import type { TokenResponse, UserOut, WalletNonceResponse, WalletVerifyBody } from "../types";

/** The current user, from the stored JWT. Pages can gate on `isError` to redirect to login. */
export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: () => api.get<UserOut>("/auth/me"),
    retry: false,
  });
}

export function useDevLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => api.post<TokenResponse>("/auth/dev-login", { email }),
    onSuccess: (data) => {
      setToken(data.access_token);
      qc.setQueryData(qk.me, data.user);
    },
  });
}

/**
 * Pannaga: these two just call the backend endpoints. The BridgeKey connect
 * flow and message signing live in your wallet adapter - call useWalletNonce
 * first, sign `message` with the adapter, then call useWalletLogin with the
 * resulting signature.
 */
export function useWalletNonce() {
  return useMutation({
    mutationFn: (address: string) => api.post<WalletNonceResponse>("/auth/nonce", { address }),
  });
}

export function useWalletLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: WalletVerifyBody) => api.post<TokenResponse>("/auth/wallet-login", body),
    onSuccess: (data) => {
      setToken(data.access_token);
      qc.setQueryData(qk.me, data.user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return () => {
    clearToken();
    qc.clear();
  };
}
