import type { WalletAdapter } from "@/lib/wallet/adapter";

// Real BridgeKey implementation (Pannaga).
export const bridgekeyAdapter: WalletAdapter = {
  isInstalled: () => false,
  connect: async () => { throw new Error("not implemented"); },
  disconnect: async () => {},
  signMessage: async () => { throw new Error("not implemented"); },
  sendTransaction: async () => { throw new Error("not implemented"); },
};
