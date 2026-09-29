import type { WalletAdapter } from "@/lib/wallet/adapter";
import { resolveWalletForUser } from "@/lib/wallet/identity";

export const mockAdapter: WalletAdapter = {
  isInstalled: () => true,
  connect: async () => ({ address: resolveWalletForUser(), network: "MST Testnet" }),
  disconnect: async () => {},
  signMessage: async () => "0xmocksignature",
  sendTransaction: async () => ({ txHash: "0xmocktx" }),
};
